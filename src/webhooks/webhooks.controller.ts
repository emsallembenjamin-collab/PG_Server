import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { WebhooksService } from "./webhooks.service";
import { ProvidersService } from "../providers/providers.service";
import { Public } from "../common/decorators/api-key.decorator";
import { DpayService } from "../providers/providers/dpay/dpay.service";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly providersService: ProvidersService,
  ) {}

  @Post("providers/:providerName/callback")
  @Public()
  @ApiOperation({
    summary: "Handle provider webhook callback",
    description:
      "DPay: deposit/withdrawal may use form-style payloads; **payout completion** uses JSON with `sign` in body. On success, DPay expects plain text `SUCCESS` as the response body.",
  })
  async handleProviderWebhook(
    @Param("providerName") providerName: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ) {
    const provider = await this.providersService.findByName(providerName);
    const providerService = this.providersService.getProviderService(
      providerName,
    );

    const signature =
      headers["p-signature"] ||
      headers["signature"] ||
      headers["x-signature"] ||
      "";

    const envSecret =
      process.env[`${providerName.toUpperCase()}_WEBHOOK_SECRET`] || "";
    const providerNameLower = providerName.toLowerCase();

    if (providerNameLower === "dpay") {
      const dpaySecret = envSecret || process.env.DPAY_SECRET || "";
      const dpay = providerService as DpayService;

      if (DpayService.isPayoutCallbackPayload(payload)) {
        if (!dpay.verifyPayoutCallback(payload, dpaySecret)) {
          throw new UnauthorizedException(
            "Invalid DPay payout callback signature",
          );
        }
      } else {
        if (!dpay.verifyWebhook(payload, signature, dpaySecret)) {
          throw new UnauthorizedException("Invalid DPay webhook signature");
        }
      }
    } else {
      if (!providerService.verifyWebhook(payload, signature, envSecret)) {
        throw new UnauthorizedException("Invalid webhook signature");
      }
    }

    await this.webhooksService.handleProviderWebhook(
      provider.id,
      payload.event || "transaction.updated",
      payload,
    );

    if (providerNameLower === "dpay") {
      return res.status(200).type("text/plain").send("SUCCESS");
    }

    return res.status(200).json({ success: true });
  }
}
