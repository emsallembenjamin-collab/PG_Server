import type { Request } from 'express';

/** Cookie name used by the Merchant Next.js portal (same-site) — optional fallback if headers are stripped. */
export const MERCHANT_PORTAL_API_KEY_COOKIE = 'goldpay_merchant_api_key';

function parseCookieHeader(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    const v = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return undefined;
}

/**
 * Resolves the merchant API key from the request.
 * Order: `X-API-Key`, `Authorization: Bearer gpk_...`, portal cookie (same-site).
 * Some reverse proxies drop custom headers on PATCH; Bearer and cookie are fallbacks.
 */
export function extractMerchantApiKey(request: Request): string | undefined {
  const raw = request.headers['x-api-key'];
  const fromHeader = Array.isArray(raw) ? raw[0] : raw;
  if (typeof fromHeader === 'string' && fromHeader.trim()) {
    return fromHeader.trim();
  }

  const auth = request.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith('gpk_')) {
      return token;
    }
  }

  const fromCookie = parseCookieHeader(
    request.headers['cookie'] as string | undefined,
    MERCHANT_PORTAL_API_KEY_COOKIE,
  );
  if (fromCookie?.trim()) {
    return fromCookie.trim();
  }

  return undefined;
}
