export type DpayBalanceInquirySuccess = {
  success: true;
  code: number | string;
  message?: string;
  merchant_num: string;
  coin: string;
  fcoin: string;
  sign?: string;
};

export type DpayBalanceInquiryError = {
  success: false;
  providerErrorCode?: string | number;
  providerErrorMessage?: string;
  message?: string;
  raw?: unknown;
};

export type DpayBalanceInquiryResult =
  | DpayBalanceInquirySuccess
  | DpayBalanceInquiryError;

