import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Reconciliation, ReconciliationType, ReconciliationStatus } from './entities/reconciliation.entity';
import { ReconciliationDiscrepancy, DiscrepancyType, DiscrepancyStatus } from './entities/reconciliation-discrepancy.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import { WebhookDelivery, WebhookDeliveryStatus } from '../webhooks/entities/webhook-delivery.entity';
import { ProvidersService } from '../providers/providers.service';
import { MerchantsService } from '../merchants/merchants.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(Reconciliation)
    private reconciliationRepository: Repository<Reconciliation>,
    @InjectRepository(ReconciliationDiscrepancy)
    private discrepancyRepository: Repository<ReconciliationDiscrepancy>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(WebhookDelivery)
    private webhookDeliveryRepository: Repository<WebhookDelivery>,
    private providersService: ProvidersService,
    private merchantsService: MerchantsService,
    private webhooksService: WebhooksService,
  ) {}

  /**
   * Run merchant reconciliation
   */
  async reconcileMerchant(
    merchantId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Reconciliation> {
    const reconciliation = this.reconciliationRepository.create({
      type: ReconciliationType.MERCHANT,
      status: ReconciliationStatus.IN_PROGRESS,
      reconciliation_date: startDate,
      merchant_id: merchantId,
    });

    const saved = await this.reconciliationRepository.save(reconciliation);

    try {
      const transactions = await this.transactionRepository.find({
        where: {
          merchant_id: merchantId,
          created_at: Between(startDate, endDate),
        },
        relations: ['provider'],
      });

      const stats = this.calculateStatistics(transactions);
      const discrepancies = await this.detectDiscrepancies(
        saved.id,
        transactions,
      );

      saved.total_transactions = stats.total;
      saved.total_amount = stats.totalAmount;
      saved.succeeded_count = stats.succeeded;
      saved.succeeded_amount = stats.succeededAmount;
      saved.failed_count = stats.failed;
      saved.failed_amount = stats.failedAmount;
      saved.pending_count = stats.pending;
      saved.pending_amount = stats.pendingAmount;
      saved.discrepancy_count = discrepancies.length;
      saved.status =
        discrepancies.length > 0
          ? ReconciliationStatus.DISCREPANCY
          : ReconciliationStatus.COMPLETED;

      return this.reconciliationRepository.save(saved);
    } catch (error) {
      saved.status = ReconciliationStatus.FAILED;
      saved.notes = error.message;
      await this.reconciliationRepository.save(saved);
      throw error;
    }
  }

  /**
   * Run provider reconciliation
   */
  async reconcileProvider(
    providerId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Reconciliation> {
    const reconciliation = this.reconciliationRepository.create({
      type: ReconciliationType.PROVIDER,
      status: ReconciliationStatus.IN_PROGRESS,
      reconciliation_date: startDate,
      provider_id: providerId,
    });

    const saved = await this.reconciliationRepository.save(reconciliation);

    try {
      const transactions = await this.transactionRepository.find({
        where: {
          provider_id: providerId,
          created_at: Between(startDate, endDate),
        },
        relations: ['merchant'],
      });

      const stats = this.calculateStatistics(transactions);
      const discrepancies = await this.detectDiscrepancies(
        saved.id,
        transactions,
      );

      saved.total_transactions = stats.total;
      saved.total_amount = stats.totalAmount;
      saved.succeeded_count = stats.succeeded;
      saved.succeeded_amount = stats.succeededAmount;
      saved.failed_count = stats.failed;
      saved.failed_amount = stats.failedAmount;
      saved.pending_count = stats.pending;
      saved.pending_amount = stats.pendingAmount;
      saved.discrepancy_count = discrepancies.length;
      saved.status =
        discrepancies.length > 0
          ? ReconciliationStatus.DISCREPANCY
          : ReconciliationStatus.COMPLETED;

      return this.reconciliationRepository.save(saved);
    } catch (error) {
      saved.status = ReconciliationStatus.FAILED;
      saved.notes = error.message;
      await this.reconciliationRepository.save(saved);
      throw error;
    }
  }

  /**
   * Run daily reconciliation (all merchants and providers)
   */
  async reconcileDaily(date: Date): Promise<Reconciliation[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const reconciliation = this.reconciliationRepository.create({
      type: ReconciliationType.DAILY,
      status: ReconciliationStatus.IN_PROGRESS,
      reconciliation_date: date,
    });

    const saved = await this.reconciliationRepository.save(reconciliation);

    try {
      const transactions = await this.transactionRepository.find({
        where: {
          created_at: Between(startDate, endDate),
        },
        relations: ['merchant', 'provider'],
      });

      const stats = this.calculateStatistics(transactions);
      const discrepancies = await this.detectDiscrepancies(
        saved.id,
        transactions,
      );

      saved.total_transactions = stats.total;
      saved.total_amount = stats.totalAmount;
      saved.succeeded_count = stats.succeeded;
      saved.succeeded_amount = stats.succeededAmount;
      saved.failed_count = stats.failed;
      saved.failed_amount = stats.failedAmount;
      saved.pending_count = stats.pending;
      saved.pending_amount = stats.pendingAmount;
      saved.discrepancy_count = discrepancies.length;
      saved.status =
        discrepancies.length > 0
          ? ReconciliationStatus.DISCREPANCY
          : ReconciliationStatus.COMPLETED;

      await this.reconciliationRepository.save(saved);

      return [saved];
    } catch (error) {
      saved.status = ReconciliationStatus.FAILED;
      saved.notes = error.message;
      await this.reconciliationRepository.save(saved);
      throw error;
    }
  }

  /**
   * Calculate transaction statistics
   */
  private calculateStatistics(transactions: Transaction[]) {
    const stats = {
      total: transactions.length,
      totalAmount: 0,
      succeeded: 0,
      succeededAmount: 0,
      failed: 0,
      failedAmount: 0,
      pending: 0,
      pendingAmount: 0,
    };

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      stats.totalAmount += amount;

      switch (tx.status) {
        case TransactionStatus.SUCCEEDED:
          stats.succeeded++;
          stats.succeededAmount += amount;
          break;
        case TransactionStatus.FAILED:
        case TransactionStatus.REVERSED:
          stats.failed++;
          stats.failedAmount += amount;
          break;
        default:
          stats.pending++;
          stats.pendingAmount += amount;
      }
    }

    return stats;
  }

  /**
   * Detect discrepancies in transactions
   */
  private async detectDiscrepancies(
    reconciliationId: number,
    transactions: Transaction[],
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const latestDeliveryByTxId = await this.getLatestWebhookDeliveryMap(transactions);

    for (const tx of transactions) {
      // Check for missing external_id on succeeded transactions
      if (
        tx.status === TransactionStatus.SUCCEEDED &&
        !tx.external_id
      ) {
        discrepancies.push(
          this.discrepancyRepository.create({
            reconciliation_id: reconciliationId,
            transaction_id: tx.id,
            type: DiscrepancyType.MISSING_TRANSACTION,
            description: `Transaction ${tx.id} succeeded but missing external_id`,
            expected_value: JSON.stringify({ external_id: 'required' }),
            actual_value: JSON.stringify({ external_id: null }),
          }),
        );
      }

      // Check callback delivery mismatch for terminal transactions.
      // Example: provider says success but merchant webhook is failed/pending.
      if (
        tx.status === TransactionStatus.SUCCEEDED ||
        tx.status === TransactionStatus.FAILED ||
        tx.status === TransactionStatus.REVERSED
      ) {
        const latest = latestDeliveryByTxId.get(tx.id);
        if (!latest) {
          discrepancies.push(
            this.discrepancyRepository.create({
              reconciliation_id: reconciliationId,
              transaction_id: tx.id,
              type: DiscrepancyType.STATUS_MISMATCH,
              description: `Transaction ${tx.id} is ${tx.status} but merchant callback has not been delivered`,
              expected_value: JSON.stringify({ webhook_delivery: 'success' }),
              actual_value: JSON.stringify({ webhook_delivery: 'missing' }),
            }),
          );
        } else if (latest.status !== WebhookDeliveryStatus.SUCCESS) {
          discrepancies.push(
            this.discrepancyRepository.create({
              reconciliation_id: reconciliationId,
              transaction_id: tx.id,
              type: DiscrepancyType.STATUS_MISMATCH,
              description: `Transaction ${tx.id} is ${tx.status} but latest merchant callback is ${latest.status}`,
              expected_value: JSON.stringify({
                webhook_delivery: 'success',
                transaction_status: tx.status,
              }),
              actual_value: JSON.stringify({
                webhook_delivery: latest.status,
                attempts: latest.attempt_count,
                last_error: latest.last_error || null,
              }),
            }),
          );
        }
      }

      const amount = Number(tx.amount || 0);
      const feePct = Number(tx.system_fee_percentage || 0);
      const feeAmount = Number(tx.system_fee_amount || 0);
      const thirdPartyFeePct = Number(tx.third_party_fee_percentage || 0);
      const thirdPartyFeeAmount = Number(tx.third_party_fee_amount || 0);
      const totalFeeAmount = Number(
        tx.total_fee_amount ?? feeAmount + thirdPartyFeeAmount,
      );
      const settlement = Number(tx.merchant_settlement_amount ?? tx.amount);
      const expectedFee = Math.round((amount * feePct)) / 100;
      const expectedThirdPartyFee = Math.round((amount * thirdPartyFeePct)) / 100;
      const expectedTotalFee = expectedFee + expectedThirdPartyFee;
      const expectedSettlement =
        tx.type === 'deposit' ? amount - expectedTotalFee : amount + expectedTotalFee;
      const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
      if (
        !close(feeAmount, expectedFee) ||
        !close(thirdPartyFeeAmount, expectedThirdPartyFee) ||
        !close(totalFeeAmount, expectedTotalFee) ||
        !close(settlement, expectedSettlement)
      ) {
        discrepancies.push(
          this.discrepancyRepository.create({
            reconciliation_id: reconciliationId,
            transaction_id: tx.id,
            type: DiscrepancyType.FEE_MISMATCH,
            description: `Transaction ${tx.id} has fee/settlement mismatch`,
            expected_value: JSON.stringify({
              system_fee_amount: expectedFee.toFixed(2),
              third_party_fee_amount: expectedThirdPartyFee.toFixed(2),
              total_fee_amount: expectedTotalFee.toFixed(2),
              merchant_settlement_amount: expectedSettlement.toFixed(2),
            }),
            actual_value: JSON.stringify({
              system_fee_percentage: feePct,
              system_fee_amount: feeAmount,
              third_party_fee_percentage: thirdPartyFeePct,
              third_party_fee_amount: thirdPartyFeeAmount,
              total_fee_amount: totalFeeAmount,
              merchant_settlement_amount: settlement,
            }),
          }),
        );
      }

      // Check for pending transactions older than 24 hours
      if (
        tx.status === TransactionStatus.PENDING ||
        tx.status === TransactionStatus.PROCESSING
      ) {
        const age = Date.now() - tx.created_at.getTime();
        const hours24 = 24 * 60 * 60 * 1000;
        if (age > hours24) {
          discrepancies.push(
            this.discrepancyRepository.create({
              reconciliation_id: reconciliationId,
              transaction_id: tx.id,
              type: DiscrepancyType.STATUS_MISMATCH,
              description: `Transaction ${tx.id} has been pending for more than 24 hours`,
              expected_value: JSON.stringify({ status: 'succeeded or failed' }),
              actual_value: JSON.stringify({ status: tx.status }),
            }),
          );
        }
      }
    }

    // Check for duplicate external_ids
    const externalIdMap = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      if (tx.external_id) {
        if (!externalIdMap.has(tx.external_id)) {
          externalIdMap.set(tx.external_id, []);
        }
        externalIdMap.get(tx.external_id)!.push(tx);
      }
    }

    for (const [externalId, txs] of externalIdMap.entries()) {
      if (txs.length > 1) {
        discrepancies.push(
          this.discrepancyRepository.create({
            reconciliation_id: reconciliationId,
            transaction_id: txs[0].id,
            type: DiscrepancyType.DUPLICATE_TRANSACTION,
            description: `Duplicate external_id: ${externalId} found in ${txs.length} transactions`,
            expected_value: JSON.stringify({ count: 1 }),
            actual_value: JSON.stringify({ count: txs.length, transaction_ids: txs.map(t => t.id) }),
          }),
        );
      }
    }

    if (discrepancies.length > 0) {
      await this.discrepancyRepository.save(discrepancies);
    }

    return discrepancies;
  }

  private async getLatestWebhookDeliveryMap(
    transactions: Transaction[],
  ): Promise<Map<number, WebhookDelivery>> {
    const txIds = transactions.map((tx) => tx.id);
    if (txIds.length === 0) {
      return new Map();
    }
    const deliveries = await this.webhookDeliveryRepository.find({
      where: { transaction_id: In(txIds) },
      order: { updated_at: 'DESC', id: 'DESC' },
    });
    const map = new Map<number, WebhookDelivery>();
    for (const delivery of deliveries) {
      if (!map.has(delivery.transaction_id)) {
        map.set(delivery.transaction_id, delivery);
      }
    }
    return map;
  }

  /**
   * Get reconciliation by ID
   */
  async findOne(id: number): Promise<Reconciliation> {
    return this.reconciliationRepository.findOne({
      where: { id },
      relations: ['merchant', 'provider', 'discrepancies', 'discrepancies.transaction'],
    });
  }

  /**
   * Get all reconciliations with filters
   */
  async findAll(filters: {
    type?: ReconciliationType;
    status?: ReconciliationStatus;
    merchantId?: number;
    providerId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const query = this.reconciliationRepository.createQueryBuilder('reconciliation')
      .leftJoinAndSelect('reconciliation.merchant', 'merchant')
      .leftJoinAndSelect('reconciliation.provider', 'provider')
      .leftJoinAndSelect('reconciliation.discrepancies', 'discrepancies');

    if (filters.type) {
      query.andWhere('reconciliation.type = :type', { type: filters.type });
    }
    if (filters.status) {
      query.andWhere('reconciliation.status = :status', { status: filters.status });
    }
    if (filters.merchantId) {
      query.andWhere('reconciliation.merchant_id = :merchantId', { merchantId: filters.merchantId });
    }
    if (filters.providerId) {
      query.andWhere('reconciliation.provider_id = :providerId', { providerId: filters.providerId });
    }
    if (filters.startDate) {
      query.andWhere('reconciliation.reconciliation_date >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('reconciliation.reconciliation_date <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('reconciliation.reconciliation_date', 'DESC');

    return query.getMany();
  }

  /**
   * Resolve discrepancy
   */
  async resolveDiscrepancy(
    discrepancyId: number,
    resolutionNotes: string,
    resolvedBy: number,
  ): Promise<ReconciliationDiscrepancy> {
    const discrepancy = await this.discrepancyRepository.findOne({
      where: { id: discrepancyId },
    });

    if (!discrepancy) {
      throw new Error('Discrepancy not found');
    }

    discrepancy.status = DiscrepancyStatus.RESOLVED;
    discrepancy.resolution_notes = resolutionNotes;
    discrepancy.resolved_by = resolvedBy;
    discrepancy.resolved_at = new Date();

    return this.discrepancyRepository.save(discrepancy);
  }

  async replayMerchantCallbackForDiscrepancy(
    discrepancyId: number,
  ): Promise<{ message: string; deliveryTriggered: boolean }> {
    const discrepancy = await this.discrepancyRepository.findOne({
      where: { id: discrepancyId },
    });
    if (!discrepancy) {
      throw new Error('Discrepancy not found');
    }
    if (!discrepancy.transaction_id) {
      return {
        message: 'Discrepancy has no transaction reference',
        deliveryTriggered: false,
      };
    }
    await this.webhooksService.deliverMerchantWebhook(discrepancy.transaction_id);
    return {
      message: `Merchant callback replay queued for transaction ${discrepancy.transaction_id}`,
      deliveryTriggered: true,
    };
  }
}
