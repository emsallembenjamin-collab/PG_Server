export type DpayPayoutStateLabel =
  | "succeeded"
  | "rejected"
  | "processing"
  | "unknown";

export type DpayPayoutInquirySuccess = {
  success: true;
  code: number | string;
  message?: string;
  payout: {
    serial_number: string;
    merchant_order: string;
    state: number;
    state_label: DpayPayoutStateLabel;
    success_time?: string;
    /** Amount in VND (1 unit = 1 VND per DPay docs). */
    coin: string;
  };
};

export type DpayPayoutInquiryError = {
  success: false;
  providerErrorCode?: string | number;
  providerErrorMessage?: string;
  message?: string;
  raw?: unknown;
};

export type DpayPayoutInquiryResult =
  | DpayPayoutInquirySuccess
  | DpayPayoutInquiryError;
