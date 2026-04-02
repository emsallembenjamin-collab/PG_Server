/** Unified response for `POST /funding/balance-inquiry` (DPay `Look/get_coin`). */
export type MerchantBalanceInquiryResponse =
  | {
      success: true;
      code: number | string;
      message?: string;
      merchant_num: string;
      coin: string;
      fcoin: string;
    }
  | {
      success: false;
      provider_error?: {
        code?: string | number;
        message?: string;
      };
      raw?: unknown;
    };

