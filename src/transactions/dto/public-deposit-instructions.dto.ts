/**
 * Response for `GET /api/v1/public/deposit/:token` — no authentication.
 * Omits merchant identifiers.
 */
export interface PublicDepositInstructionsResponse {
  transaction_id: number;
  /** Same code used in `/pay/{public_code}` when present. */
  public_code?: string;
  type: 'deposit';
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
  provider_error?: {
    code?: string | number;
    message?: string;
  };
  created_at: Date;
  updated_at: Date;
}
