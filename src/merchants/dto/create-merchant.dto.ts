import { IsArray, IsEmail, IsIP, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMerchantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  webhook_url?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['203.0.113.10', '198.51.100.25'],
  })
  @IsOptional()
  @IsArray()
  @IsIP(undefined, { each: true })
  whitelisted_ips?: string[];
}
