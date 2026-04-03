/**
 * Merchant-facing transaction shape for GoldPay public API responses.
 * `payment` holds normalized instructions from the merchant's assigned provider.
 */
export interface MerchantTransactionResponse {
  id: number;
  merchant_id: number;
  /** Legacy opaque token; still valid for `/pay/{public_token}`. */
  public_token?: string;
  /** Unique checkout code (e.g. DS20260402…); preferred segment in `payment_url`. */
  public_code?: string;
  /** Absolute URL on the merchant portal (configure `MERCHANT_PORTAL_PUBLIC_URL` on GoldPay). */
  payment_url?: string;
  /** ISO 8601 — after this time the public checkout link no longer shows payment instructions (deposits). */
  payment_link_expires_at?: string;
  type: string;
  amount: number;
  currency: string;
  reference_id?: string;
  external_id?: string;
  status: string;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
  provider?: {
    id: number;
    name: string;
    display_name: string;
  };
  payment?: Record<string, unknown>;
  /** Present when the assigned provider returned an error (e.g. DPay). See docs/DPAY_ERROR_CODES.md. */
  provider_error?: {
    code?: string | number;
    message?: string;
  };
  created_at: Date;
  updated_at: Date;
}
