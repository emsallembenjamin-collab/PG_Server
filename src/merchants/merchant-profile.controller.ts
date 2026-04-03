import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { MerchantsService } from "./merchants.service";
import { serializeMerchantBalances } from "./merchant-balance.util";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { ApiKey } from "../common/decorators/api-key.decorator";
import { MERCHANT_INTEGRATION_TAG } from "../docs/swagger-merchant.filter";
import { UpdateMerchantProfileDto } from "./dto/update-merchant-profile.dto";

@ApiTags(MERCHANT_INTEGRATION_TAG)
@Controller("merchants")
@UseGuards(ApiKeyGuard)
@ApiSecurity("api-key")
export class MerchantProfileController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get("me")
  @ApiKey()
  @ApiOperation({
    summary: "Get current merchant profile",
    description:
      "Returns the merchant record for the API key (name, status, webhook settings, assigned provider id, etc.).",
  })
  async getMe(@Request() req) {
    return {
      ...req.merchant,
      ...serializeMerchantBalances(req.merchant),
    };
  }

  @Patch("me")
  @ApiKey()
  @ApiOperation({
    summary: "Update current merchant profile",
    description:
      "Updates name, email, phone, username, and bio for the authenticated merchant.",
  })
  async patchMe(@Request() req, @Body() body: UpdateMerchantProfileDto) {
    const merchant = await this.merchantsService.updateProfile(
      req.merchant.id,
      body,
    );
    return {
      ...merchant,
      ...serializeMerchantBalances(merchant),
    };
  }

  @Post("me/api-keys/rotate")
  @ApiKey()
  @ApiOperation({
    summary: "Rotate API key",
    description:
      "Invalidates the current key and returns a new secret. Use the new `X-API-Key` on subsequent requests.",
  })
  async rotateCurrentApiKey(@Request() req, @Body() body: { name?: string }) {
    const headerValue = req.headers["x-api-key"];
    const currentApiKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    const apiKey = await this.merchantsService.rotateCurrentApiKey(
      req.merchant.id,
      currentApiKey,
      body.name,
    );
    return { api_key: apiKey };
  }
}
