import { OmitType } from "@nestjs/swagger";
import { CreateTransactionDto } from "./create-transaction.dto";

/** Body for POST /funding/deposits — `type` is implied as deposit. */
export class CreateFundingDepositDto extends OmitType(CreateTransactionDto, [
  "type",
] as const) {}

/** Body for POST /funding/withdrawals — `type` is implied as withdrawal. */
export class CreateFundingWithdrawalDto extends OmitType(CreateTransactionDto, [
  "type",
] as const) {}
