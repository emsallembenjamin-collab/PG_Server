export interface ProcessTransactionRequest {
  transactionId: number;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface ProcessTransactionResponse {
  success: boolean;
  externalId?: string;
  paymentUrl?: string;
  status?: string;
  error?: string;
  callbackPayload?: Record<string, any>;
  callbackDelayMs?: number;
}

export interface ProviderWebhookPayload {
  event: string;
  transactionId?: string;
  status: string;
  data: Record<string, any>;
}

export interface IProviderService {
  processTransaction(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse>;

  verifyWebhook(
    payload: any,
    signature: string,
    secret: string,
  ): boolean;

  normalizeStatus(providerStatus: string): string;
}
