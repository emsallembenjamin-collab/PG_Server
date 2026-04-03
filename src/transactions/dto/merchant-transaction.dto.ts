/**
 * Merchant-facing transaction shape for GoldPay public API responses.
 * `payment` holds normalized instructions from the merchant's assigned provider.
 */
export interface MerchantTransactionResponse {
  id: number;
  merchant_id: number;
  /** Share `payment_page_url` or `/pay/{public_token}` on the merchant portal so customers can pay without logging in. */
  public_token?: string;
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
