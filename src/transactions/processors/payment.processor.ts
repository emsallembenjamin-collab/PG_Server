import { Processor, Process } from "@nestjs/bull";
import { Job } from "bull";
import { Injectable } from "@nestjs/common";
import { WebhooksService } from "../../webhooks/webhooks.service";

/**
 * Handles delayed provider callbacks (e.g. sandbox) after the main transaction
 * is processed synchronously in TransactionsService.create.
 */
@Processor("payment-processing")
@Injectable()
export class PaymentProcessor {
  constructor(private webhooksService: WebhooksService) {}

  @Process("delayed-provider-callback")
  async handleDelayedCallback(job: Job) {
    const { providerId, callbackPayload } = job.data;
    await this.webhooksService.handleProviderWebhook(
      providerId,
      callbackPayload.event || "transaction.updated",
      callbackPayload,
    );
  }
}
