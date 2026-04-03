import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIP,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { MerchantStatus } from '../entities/merchant.entity';

export class UpdateMerchantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, enum: MerchantStatus })
  @IsOptional()
  @IsEnum(MerchantStatus)
  status?: MerchantStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl()
  webhook_url?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: [String],
    example: ['203.0.113.10', '198.51.100.25'],
  })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, { each: true })
  whitelisted_ips?: string[] | null;

  @ApiProperty({
    required: false,
    description:
      'ISO 4217 code for the internal ledger (withdrawals must match; deposits credit when currency matches).',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  balance_currency?: string;
}
