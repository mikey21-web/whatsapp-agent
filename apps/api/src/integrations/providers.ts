import type { IntegrationKind } from '@diyaa/db';
import { env } from '../config/env';

interface ProviderSpec {
  kind: IntegrationKind;
  label: string;
  authUrl: (state: string, redirectUri: string, extra?: Record<string, string>) => string;
  tokenUrl: string;
  scopes: string;
  clientId: string;
  clientSecret: string;
}

export function specFor(kind: IntegrationKind): ProviderSpec {
  switch (kind) {
    case 'GOOGLE_CALENDAR':
      return {
        kind,
        label: 'Google Calendar',
        authUrl: (state, redirectUri) =>
          `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: env.GOOGLE_SCOPES,
            access_type: 'offline',
            prompt: 'consent',
            state,
          })}`,
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: env.GOOGLE_SCOPES,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      };
    case 'ZOHO':
      return {
        kind,
        label: 'Zoho CRM',
        authUrl: (state, redirectUri) =>
          `https://accounts.zoho.com/oauth/v2/auth?${new URLSearchParams({
            client_id: env.ZOHO_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: env.ZOHO_SCOPES,
            access_type: 'offline',
            prompt: 'consent',
            state,
          })}`,
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        scopes: env.ZOHO_SCOPES,
        clientId: env.ZOHO_CLIENT_ID,
        clientSecret: env.ZOHO_CLIENT_SECRET,
      };
    case 'SHOPIFY':
      return {
        kind,
        label: 'Shopify',
        // Shopify URL is per-shop; the controller composes it from the `shop` query param.
        authUrl: (state, redirectUri, extra) => {
          const shop = extra?.shop;
          if (!shop) throw new Error('Shopify needs ?shop=<store>.myshopify.com');
          return `https://${shop}/admin/oauth/authorize?${new URLSearchParams({
            client_id: env.SHOPIFY_API_KEY,
            scope: env.SHOPIFY_SCOPES,
            redirect_uri: redirectUri,
            state,
          })}`;
        },
        tokenUrl: '', // shop-specific, handled in controller
        scopes: env.SHOPIFY_SCOPES,
        clientId: env.SHOPIFY_API_KEY,
        clientSecret: env.SHOPIFY_API_SECRET,
      };
    case 'TALLY':
      return {
        kind,
        label: 'Tally',
        // Tally has no public OAuth — we use a long-lived API key entered by the user.
        authUrl: () => '',
        tokenUrl: '',
        scopes: '',
        clientId: '',
        clientSecret: '',
      };
  }
}
