import type { DpayPayoutInquirySuccess } from "../../providers/providers/dpay/dpay-payout-inquiry.types";

/** Unified response for `POST /funding/payout-inquiry`. */
export type MerchantPayoutInquiryResponse =
  | {
      success: true;
      code: number | string;
      message?: string;
      payout: DpayPayoutInquirySuccess["payout"];
    }
  | {
      success: false;
      provider_error?: {
        code?: string | number;
        message?: string;
      };
      raw?: unknown;
    };
