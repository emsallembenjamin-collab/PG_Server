import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TransactionType } from '../entities/transaction.entity';
import {
  SANDBOX_DELIVERY_MODES,
  SANDBOX_OUTCOMES,
} from '../sandbox.utils';

class SandboxTransactionDto {
  @ApiProperty({ required: false, enum: SANDBOX_OUTCOMES })
  @IsOptional()
  @IsIn(SANDBOX_OUTCOMES)
  outcome?: (typeof SANDBOX_OUTCOMES)[number];

  @ApiProperty({ required: false, enum: SANDBOX_DELIVERY_MODES })
  @IsOptional()
  @IsIn(SANDBOX_DELIVERY_MODES)
  delivery_mode?: (typeof SANDBOX_DELIVERY_MODES)[number];

  @ApiProperty({ required: false, minimum: 0, maximum: 30000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30000)
  delay_ms?: number;
}

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reference_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotency_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // When using HTML forms, `metadata` often arrives as a JSON string.
    if (typeof value === 'string') {
      try {
        return value.trim() ? JSON.parse(value) : undefined;
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ required: false, type: () => SandboxTransactionDto })
  @IsOptional()
  @ValidateNested()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return value.trim() ? JSON.parse(value) : undefined;
      } catch {
        return value;
      }
    }
    return value;
  })
  @Type(() => SandboxTransactionDto)
  sandbox?: SandboxTransactionDto;
}
