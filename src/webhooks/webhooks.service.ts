import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import axios from 'axios';
import * as crypto from 'crypto';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { MerchantsService } from '../merchants/merchants.service';
import { TransactionStatus } from '../transactions/entities/transaction.entity';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(WebhookEvent)
    private eventRepository: Repository<WebhookEvent>,
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,
    private merchantsService: MerchantsService,
    private providersService: ProvidersService,
    @InjectQueue('webhook-delivery')
    private webhookQueue: Queue,
  ) {}

  async deliverMerchantWebhook(transactionId: number): Promise<void> {
    const transaction = await this.transactionsService.findOne(transactionId);
    const merchant = await this.merchantsService.findOne(transaction.merchant_id);

    if (!merchant.webhook_url) {
      return; // No webhook URL configured
    }

    const payload = {
      event: 'transaction.updated',
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        reference_id: transaction.reference_id,
        external_id: transaction.external_id,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    };

    // Create delivery record
    const delivery = this.deliveryRepository.create({
      merchant_id: merchant.id,
      transaction_id: transactionId,
      url: merchant.webhook_url,
      payload: JSON.stringify(payload),
      status: WebhookDeliveryStatus.PENDING,
    });

    const savedDelivery = await this.deliveryRepository.save(delivery);

    // Enqueue webhook delivery
    await this.webhookQueue.add('deliver-webhook', {
      deliveryId: savedDelivery.id,
      url: merchant.webhook_url,
      payload,
      secret: merchant.webhook_secret,
    });
  }

  async handleProviderWebhook(
    providerId: number,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const providerTxnId = String(
      payload.txnId ||
        payload.transaction_id ||
        payload.transactionId ||
        payload.ref_id ||
        payload.serial_number ||
        '',
    ).trim();
    const merchantOrderId = String(
      payload.orderId ||
        payload.order_id ||
        payload.reference_id ||
        payload.merchant_order ||
        payload.order ||
        '',
    ).trim();

    // Log webhook event
    const event = this.eventRepository.create({
      provider_id: providerId,
      event_type: eventType,
      payload: JSON.stringify(payload),
      transaction_ref: providerTxnId || merchantOrderId || null,
    });

    await this.eventRepository.save(event);

    const transaction = await this.transactionsService.findByProviderReferences(
      providerId,
      providerTxnId || undefined,
      merchantOrderId || undefined,
    );

    if (!transaction) {
      return;
    }

    const provider = await this.providersService.findOne(providerId);
    const providerService = this.providersService.getProviderService(provider.name);
    const normalizedStatus = providerService.normalizeStatus(
      String(payload.status || payload.state || payload.code || ''),
    ) as TransactionStatus;

    if (normalizedStatus === TransactionStatus.SUCCEEDED) {
      await this.transactionsService.updateStatus(
        transaction.id,
        TransactionStatus.SUCCEEDED,
        providerTxnId || transaction.external_id,
      );
      await this.deliverMerchantWebhook(transaction.id);
      return;
    }

    if (normalizedStatus === TransactionStatus.FAILED) {
      await this.transactionsService.updateStatus(
        transaction.id,
        TransactionStatus.FAILED,
        providerTxnId || transaction.external_id,
        payload.message || payload.code || 'Provider reported failed status',
      );
      await this.deliverMerchantWebhook(transaction.id);
      return;
    }

    await this.transactionsService.updateStatus(
      transaction.id,
      TransactionStatus.PROCESSING,
      providerTxnId || transaction.external_id,
    );
  }

  signPayload(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    return signature;
  }
}
