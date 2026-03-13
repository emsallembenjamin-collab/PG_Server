import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { TransactionStatus } from "../entities/transaction.entity";

const FORCEABLE_SANDBOX_STATUSES = [
  TransactionStatus.PROCESSING,
  TransactionStatus.SUCCEEDED,
  TransactionStatus.FAILED,
  TransactionStatus.REVERSED,
] as const;

const REPLAYABLE_SANDBOX_STATUSES = [
  TransactionStatus.PROCESSING,
  TransactionStatus.SUCCEEDED,
  TransactionStatus.FAILED,
] as const;

export class ForceSandboxOutcomeDto {
  @ApiProperty({
    enum: FORCEABLE_SANDBOX_STATUSES,
  })
  @IsIn(FORCEABLE_SANDBOX_STATUSES)
  status: TransactionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  failureReason?: string;
}

export class ReplaySandboxCallbackDto {
  @ApiProperty({
    required: false,
    enum: REPLAYABLE_SANDBOX_STATUSES,
    default: TransactionStatus.SUCCEEDED,
  })
  @IsOptional()
  @IsIn(REPLAYABLE_SANDBOX_STATUSES)
  status?: TransactionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
}
