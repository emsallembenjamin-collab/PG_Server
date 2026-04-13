import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, Max, Min } from "class-validator";

export class UpdateSystemFeeDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deposit_fee_percentage?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  withdrawal_fee_percentage?: number;
}
