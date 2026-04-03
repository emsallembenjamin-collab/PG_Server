/**
 * Response for `GET /api/v1/public/deposit/:token` — no authentication.
 * Omits merchant identifiers.
 */
export type PublicDepositInstructionsResponse =
  | PublicDepositInstructionsActive
  | PublicDepositInstructionsExpired;

export interface PublicDepositInstructionsActive {
  expired?: false;
  transaction_id: number;
  /** Same code used in `/pay/{public_code}` when present. */
  public_code?: string;
  /** ISO 8601 — link stops working after this while payment is still open. */
  payment_link_expires_at?: string;
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

export interface PublicDepositInstructionsExpired {
  expired: true;
  transaction_id: number;
  public_code?: string;
  payment_link_expires_at: string;
  type: 'deposit';
  amount: number;
  currency: string;
  status: string;
  message: string;
}
