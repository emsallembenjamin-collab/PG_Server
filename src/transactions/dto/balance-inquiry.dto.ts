import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

/** DPay balance inquiry query: `POST /Look/get_coin` */
export class BalanceInquiryDto {
  @ApiPropertyOptional({
    description:
      "Optional query time `YYYY-MM-DD HH:mm:ss`. If omitted, GoldPay uses current server time (+7 timezone) in the required format.",
    example: "2022-05-20 11:18:00",
  })
  @IsOptional()
  @IsString()
  find_date?: string;
}

