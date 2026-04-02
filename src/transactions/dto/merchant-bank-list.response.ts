export type MerchantBankListResponse =
  | {
      success: true;
      code: number | string;
      message?: string;
      data: Array<{ code: number | string; bank_name: string }>;
    }
  | {
      success: false;
      provider_error?: {
        code?: string | number;
        message?: string;
      };
      raw?: unknown;
    };

