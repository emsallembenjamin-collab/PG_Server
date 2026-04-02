export type DpayBankResource = {
  code: number | string;
  bank_name: string;
};

export type DpayBankListSuccess = {
  success: true;
  code: number | string;
  message?: string;
  data: DpayBankResource[];
};

export type DpayBankListError = {
  success: false;
  providerErrorCode?: string | number;
  providerErrorMessage?: string;
  message?: string;
  raw?: unknown;
};

export type DpayBankListResult = DpayBankListSuccess | DpayBankListError;

