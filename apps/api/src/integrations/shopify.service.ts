import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { IntegrationsService } from './integrations.service';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

interface ShopifyCreds {
  access_token: string;
  scope?: string;
}

@Injectable()
export class ShopifyService {
  constructor(private readonly integrations: IntegrationsService) {}

  /**
   * Verify the HMAC Shopify includes on OAuth callback URLs.
   * Per Shopify docs: signature is over the query string with the `hmac` param removed,
   * lexicographically sorted, joined as `key=value&...`, signed with HMAC-SHA256(SECRET).
   */
  verifyShopifyHmac(query: Record<string, string | undefined>): boolean {
    if (!env.SHOPIFY_API_SECRET) return false;
    const provided = query.hmac;
    if (!provided) return false;
    const entries = Object.entries(query)
      .filter(([k, v]) => k !== 'hmac' && k !== 'signature' && v !== undefined)
      .map(([k, v]) => [k, String(v)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    const message = entries.map(([k, v]) => `${k}=${v}`).join('&');
    const digest = createHmac('sha256', env.SHOPIFY_API_SECRET).update(message).digest('hex');
    if (digest.length !== provided.length) return false;
    return timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
  }

  async findOrdersByPhone(p: Principal, phone: string) {
    const clientId = clientOf(p);
    const creds = await this.integrations.getCredentials<ShopifyCreds>(clientId, 'SHOPIFY');
    if (!creds) throw new NotFoundException('Shopify not connected');
    const shop = creds.metadata.shop as string | undefined;
    if (!shop) throw new NotFoundException('Shop missing');

    // Search customers by phone, then fetch their orders.
    const search = await axios.get<{ customers: { id: number }[] }>(
      `https://${shop}/admin/api/2024-07/customers/search.json`,
      {
        headers: { 'X-Shopify-Access-Token': creds.creds.access_token },
        params: { query: `phone:${phone}` },
        timeout: 15_000,
      },
    );
    if (search.data.customers.length === 0) {
      await this.integrations.touchSync(clientId, 'SHOPIFY');
      return [];
    }
    const customerId = search.data.customers[0]!.id;
    const orders = await axios.get<{
      orders: { id: number; name: string; financial_status: string; total_price: string; created_at: string }[];
    }>(
      `https://${shop}/admin/api/2024-07/customers/${customerId}/orders.json`,
      {
        headers: { 'X-Shopify-Access-Token': creds.creds.access_token },
        params: { status: 'any', limit: 20 },
        timeout: 15_000,
      },
    );
    await this.integrations.touchSync(clientId, 'SHOPIFY');
    return orders.data.orders.map((o) => ({
      id: o.id,
      number: o.name,
      status: o.financial_status,
      total: o.total_price,
      createdAt: o.created_at,
    }));
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
