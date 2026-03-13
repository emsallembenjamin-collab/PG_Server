import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional } from 'class-validator';

export class UpsertCurrencyRateDto {
  @ApiProperty()
  @IsNumber()
  to_currency_id: number;

  @ApiProperty()
  @IsNumber()
  rate: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  reverse_rate?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsISO8601()
  expires_at?: string | null;
}
