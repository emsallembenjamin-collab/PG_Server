import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { TransactionsService } from '../transactions.service';
import { TransactionStatus } from '../entities/transaction.entity';
import { AttemptStatus } from '../entities/transaction-attempt.entity';
import { ProvidersService } from '../../providers/providers.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Processor('payment-processing')
@Injectable()
export class PaymentProcessor {
  constructor(
    private transactionsService: TransactionsService,
    private providersService: ProvidersService,
    private webhooksService: WebhooksService,
  ) {}

  @Process('process-transaction')
  async handleTransaction(job: Job) {
    const { transactionId, type, amount, currency, providerId, metadata } =
      job.data;

    try {
      // Update status to processing
      await this.transactionsService.updateStatus(
        transactionId,
        TransactionStatus.PROCESSING,
      );

      // Get provider service
      const provider = await this.providersService.findOne(providerId);
      const providerService = this.providersService.getProviderService(
        provider.name,
      );

      // Process transaction through provider
      const result = await providerService.processTransaction({
        transactionId,
        type,
        amount,
        currency,
        metadata,
      });

      // Update transaction status
      if (result.success) {
        const normalizedStatus = result.status
          ? providerService.normalizeStatus(result.status)
          : result.paymentUrl
            ? 'processing'
            : 'succeeded';

        if (normalizedStatus === 'succeeded') {
          await this.transactionsService.updateStatus(
            transactionId,
            TransactionStatus.SUCCEEDED,
            result.externalId,
          );

          // Trigger merchant webhook only for final success state.
          await this.webhooksService.deliverMerchantWebhook(transactionId);
        } else if (normalizedStatus === 'failed') {
          await this.transactionsService.updateStatus(
            transactionId,
            TransactionStatus.FAILED,
            result.externalId,
            result.error || 'Provider returned failed status',
          );
          await this.webhooksService.deliverMerchantWebhook(transactionId);
        } else {
          await this.transactionsService.updateStatus(
            transactionId,
            TransactionStatus.PROCESSING,
            result.externalId,
          );

          if (result.callbackPayload) {
            if (result.callbackDelayMs && result.callbackDelayMs > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, result.callbackDelayMs),
              );
            }

            await this.webhooksService.handleProviderWebhook(
              provider.id,
              result.callbackPayload.event || 'transaction.updated',
              result.callbackPayload,
            );
          }
        }
      } else {
        await this.transactionsService.updateStatus(
          transactionId,
          TransactionStatus.FAILED,
          undefined,
          result.error,
        );
        await this.webhooksService.deliverMerchantWebhook(transactionId);
      }

      // Log attempt
      await this.transactionsService.createAttempt(
        transactionId,
        { type, amount },
        result,
        result.success ? AttemptStatus.SUCCESS : AttemptStatus.FAILED,
        result.error,
      );
    } catch (error) {
      // Handle error
      await this.transactionsService.updateStatus(
        transactionId,
        TransactionStatus.FAILED,
        undefined,
        error.message,
      );

      throw error; // Re-throw to trigger retry
    }
  }
}
