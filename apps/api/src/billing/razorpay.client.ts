import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

interface RazorpaySubscription {
  id: string;
  status: string;
  current_end: number;
  short_url?: string;
  customer_id?: string;
}

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger('Razorpay');
  private readonly http: AxiosInstance | null;

  constructor() {
    this.http =
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? axios.create({
            baseURL: 'https://api.razorpay.com/v1',
            auth: { username: env.RAZORPAY_KEY_ID, password: env.RAZORPAY_KEY_SECRET },
            timeout: 15_000,
          })
        : null;
  }

  isConfigured(): boolean {
    return this.http !== null;
  }

  async createSubscription(args: {
    planId: string;
    notes?: Record<string, string>;
    totalCount?: number;
  }): Promise<RazorpaySubscription> {
    if (!this.http) throw new Error('Razorpay not configured');
    const { data } = await this.http.post<RazorpaySubscription>('/subscriptions', {
      plan_id: args.planId,
      total_count: args.totalCount ?? 12,
      customer_notify: 1,
      notes: args.notes,
    });
    return data;
  }

  async cancelSubscription(subId: string): Promise<RazorpaySubscription> {
    if (!this.http) throw new Error('Razorpay not configured');
    const { data } = await this.http.post<RazorpaySubscription>(
      `/subscriptions/${encodeURIComponent(subId)}/cancel`,
      { cancel_at_cycle_end: 1 },
    );
    return data;
  }

  async fetchSubscription(subId: string): Promise<RazorpaySubscription> {
    if (!this.http) throw new Error('Razorpay not configured');
    const { data } = await this.http.get<RazorpaySubscription>(
      `/subscriptions/${encodeURIComponent(subId)}`,
    );
    return data;
  }

  /**
   * Constant-time webhook signature verification.
   * Razorpay sends `x-razorpay-signature: sha256(rawBody, RAZORPAY_WEBHOOK_SECRET)`.
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature || !env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
