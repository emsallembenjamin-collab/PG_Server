import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WebhookDelivery, WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';
import { WebhooksService } from '../webhooks.service';

@Processor('webhook-delivery')
@Injectable()
export class WebhookProcessor {
  constructor(
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
    private webhooksService: WebhooksService,
  ) {}

  @Process('deliver-webhook')
  async handleWebhookDelivery(job: Job) {
    const { deliveryId, url, payload, secret } = job.data;

    const delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Webhook delivery ${deliveryId} not found`);
    }

    try {
      // Sign payload if secret is provided
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (secret) {
        const signature = this.webhooksService.signPayload(payload, secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Deliver webhook
      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000, // 10 seconds timeout
      });

      // Update delivery status
      delivery.status = WebhookDeliveryStatus.SUCCESS;
      delivery.attempt_count += 1;
      delivery.last_attempt_at = new Date();
      await this.deliveryRepository.save(delivery);
    } catch (error) {
      // Update delivery status
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.attempt_count += 1;
      delivery.last_attempt_at = new Date();
      delivery.last_error = error.message;
      await this.deliveryRepository.save(delivery);

      // Retry logic (exponential backoff)
      if (delivery.attempt_count < 5) {
        const delay = Math.pow(2, delivery.attempt_count) * 1000; // Exponential backoff
        throw new Error(`Webhook delivery failed, will retry in ${delay}ms`);
      }
    }
  }
}
