import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { CurrencyStatus } from '../entities/currency.entity';

export class CreateCurrencyDto {
  @ApiProperty()
  @IsString()
  @Length(3, 3)
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  symbol?: string | null;

  @ApiProperty({ required: false, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  decimal_places?: number;

  @ApiProperty({ required: false, enum: CurrencyStatus, default: CurrencyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CurrencyStatus)
  status?: CurrencyStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  config?: string | null;
}
