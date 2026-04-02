import { Controller, Post, Body, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { ApiKey } from "../common/decorators/api-key.decorator";
import { TransactionsService } from "./transactions.service";
import { TransactionType } from "./entities/transaction.entity";
import {
  CreateFundingDepositDto,
  CreateFundingWithdrawalDto,
} from "./dto/create-funding.dto";
import { PayoutInquiryDto } from "./dto/payout-inquiry.dto";
import { BalanceInquiryDto } from "./dto/balance-inquiry.dto";
import { BankListDto } from "./dto/bank-list.dto";
import { MERCHANT_INTEGRATION_TAG } from "../docs/swagger-merchant.filter";

/**
 * GoldPay merchant funding API. Routes use the merchant's admin-assigned provider
 * internally; merchants integrate only with these endpoints, not provider-specific APIs.
 */
@ApiTags(MERCHANT_INTEGRATION_TAG, "Funding")
@Controller("funding")
@UseGuards(ApiKeyGuard)
@ApiSecurity("api-key")
export class FundingController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post("deposits")
  @ApiKey()
  @ApiOperation({
    summary: "Create a deposit",
    description:
      "Creates a deposit using the provider assigned to this merchant. Returns payment instructions (e.g. QR, bank details, redirect URL) in `payment` when the provider supplies them.",
  })
  async createDeposit(@Request() req, @Body() body: CreateFundingDepositDto) {
    return this.transactionsService.create(req.merchant.id, {
      ...body,
      type: TransactionType.DEPOSIT,
    });
  }

  @Post("withdrawals")
  @ApiKey()
  @ApiOperation({
    summary: "Create a withdrawal",
    description:
      "Creates a withdrawal using the provider assigned to this merchant.",
  })
  async createWithdrawal(
    @Request() req,
    @Body() body: CreateFundingWithdrawalDto,
  ) {
    return this.transactionsService.create(req.merchant.id, {
      ...body,
      type: TransactionType.WITHDRAWAL,
    });
  }

  @Post("payout-inquiry")
  @ApiKey()
  @ApiOperation({
    summary: "Payout inquiry (DPay only)",
    description:
      "Queries DPay `Look/payment_order` using platform credentials. Requires assigned provider **dpay**. Use `transaction_id` of a withdrawal, or pass `merchant_order` + `find_date` as in DPay docs.",
  })
  async payoutInquiry(@Request() req, @Body() body: PayoutInquiryDto) {
    return this.transactionsService.payoutInquiry(req.merchant.id, body);
  }

  @Post("balance-inquiry")
  @ApiKey()
  @ApiOperation({
    summary: "Balance inquiry (DPay only)",
    description:
      "Queries DPay `Look/get_coin` using platform credentials. Requires assigned provider **dpay**.",
  })
  async balanceInquiry(
    @Request() req,
    @Body() body: BalanceInquiryDto,
  ) {
    return this.transactionsService.balanceInquiry(req.merchant.id, body);
  }

  @Post("bank-list")
  @ApiKey()
  @ApiOperation({
    summary: "DPay bank/channel list (CDC M)",
    description:
      "Queries DPay `POST /index/bank_list` using platform credentials. Requires assigned provider **dpay**. Use it to display available banks/channels for your selected `pay_type`.",
  })
  async bankList(@Request() req, @Body() body: BankListDto) {
    return this.transactionsService.bankList(req.merchant.id, body);
  }
}
