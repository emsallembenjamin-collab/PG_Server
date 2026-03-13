import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { CurrencyStatus } from '../entities/currency.entity';

export class UpdateCurrencyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  symbol?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  decimal_places?: number;

  @ApiProperty({ required: false, enum: CurrencyStatus })
  @IsOptional()
  @IsEnum(CurrencyStatus)
  status?: CurrencyStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  config?: string | null;
}
