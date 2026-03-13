import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Transaction, TransactionStatus } from "./entities/transaction.entity";
import {
  TransactionAttempt,
  AttemptStatus,
} from "./entities/transaction-attempt.entity";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { MerchantsService } from "../merchants/merchants.service";
import { ProvidersService } from "../providers/providers.service";
import { IdempotencyService } from "../idempotency/idempotency.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationCategory } from "../notifications/entities/notification.entity";
import { WebhooksService } from "../webhooks/webhooks.service";
import {
  buildSandboxMetadata,
  getSandboxConfig,
  isSandboxTransaction,
  SANDBOX_METADATA_LIKE,
  SANDBOX_PROVIDER_NAME,
} from "./sandbox.utils";

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionAttempt)
    private attemptRepository: Repository<TransactionAttempt>,
    private configService: ConfigService,
    private merchantsService: MerchantsService,
    private providersService: ProvidersService,
    private idempotencyService: IdempotencyService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => WebhooksService))
    private webhooksService: WebhooksService,
    @InjectQueue("payment-processing")
    private paymentQueue: Queue,
  ) {}

  private formatAmount(amount: number, currency: string) {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }

  private isSandboxEnabled() {
    const value = String(
      this.configService.get<string>("SANDBOX_MODE_ENABLED", "true"),
    ).toLowerCase();
    return value === "true" || value === "1" || value === "yes";
  }

  async create(
    merchantId: number,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    // Check idempotency
    if (createTransactionDto.idempotency_key) {
      const existing = await this.idempotencyService.getResponse(
        merchantId,
        createTransactionDto.idempotency_key,
      );
      if (existing) {
        return existing;
      }
    }

    // Verify merchant exists
    const merchant = await this.merchantsService.findOne(merchantId);

    // Get merchant's assigned provider (one provider per merchant)
    if (!merchant.provider_id) {
      throw new BadRequestException(
        "Merchant does not have a provider assigned. Please assign a provider first.",
      );
    }

    const provider = await this.providersService.findOne(merchant.provider_id);

    // Verify provider is active
    if (provider.status !== "active") {
      throw new BadRequestException(
        "Merchant's assigned provider is not active",
      );
    }

    const usesSandboxProvider = provider.name === SANDBOX_PROVIDER_NAME;
    if (usesSandboxProvider && !this.isSandboxEnabled()) {
      throw new BadRequestException("Sandbox mode is disabled");
    }

    if (createTransactionDto.sandbox && !usesSandboxProvider) {
      throw new BadRequestException(
        "Sandbox options require a merchant assigned to the sandbox provider",
      );
    }

    // Verify transaction amount is within provider limits
    if (
      (provider.min_amount &&
        createTransactionDto.amount < Number(provider.min_amount)) ||
      (provider.max_amount &&
        createTransactionDto.amount > Number(provider.max_amount))
    ) {
      throw new BadRequestException(
        `Transaction amount is outside provider limits (min: ${provider.min_amount}, max: ${provider.max_amount})`,
      );
    }

    // Create transaction
    const transaction = this.transactionRepository.create({
      merchant_id: merchantId,
      provider_id: provider.id,
      type: createTransactionDto.type,
      amount: createTransactionDto.amount,
      currency: createTransactionDto.currency || "USD",
      reference_id: createTransactionDto.reference_id,
      status: TransactionStatus.PENDING,
      metadata: (() => {
        const metadata = buildSandboxMetadata(
          createTransactionDto.metadata,
          usesSandboxProvider ? createTransactionDto.sandbox ?? {} : undefined,
        );
        return metadata ? JSON.stringify(metadata) : null;
      })(),
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    // Store idempotency key if provided
    if (createTransactionDto.idempotency_key) {
      await this.idempotencyService.storeRequest(
        merchantId,
        createTransactionDto.idempotency_key,
        createTransactionDto,
        savedTransaction,
      );
    }

    // Enqueue processing job
    await this.paymentQueue.add("process-transaction", {
      transactionId: savedTransaction.id,
      type: createTransactionDto.type,
      amount: createTransactionDto.amount,
      currency: savedTransaction.currency,
      providerId: provider.id,
      metadata: buildSandboxMetadata(
        createTransactionDto.metadata,
        usesSandboxProvider ? createTransactionDto.sandbox ?? {} : undefined,
      ),
    });

    const amountLabel = this.formatAmount(
      savedTransaction.amount,
      savedTransaction.currency,
    );

    await Promise.all([
      this.notificationsService.createForMerchant(merchantId, {
        category: NotificationCategory.TRANSACTION,
        title: "Transaction submitted",
        message: `Transaction #${savedTransaction.id} for ${amountLabel} is now pending provider processing.`,
        metadata: {
          transactionId: savedTransaction.id,
          status: savedTransaction.status,
          type: savedTransaction.type,
          providerId: provider.id,
          referenceId: savedTransaction.reference_id,
        },
      }),
      this.notificationsService.createForAllActiveAdmins({
        category: NotificationCategory.TRANSACTION,
        title: "New transaction received",
        message: `${merchant.name} submitted transaction #${savedTransaction.id} for ${amountLabel} via ${provider.display_name}.`,
        metadata: {
          transactionId: savedTransaction.id,
          merchantId: merchant.id,
          providerId: provider.id,
          status: savedTransaction.status,
          type: savedTransaction.type,
          referenceId: savedTransaction.reference_id,
        },
      }),
    ]);

    return savedTransaction;
  }

  async findOne(id: number): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ["merchant", "provider", "attempts"],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async findOneForMerchant(
    id: number,
    merchantId: number,
  ): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, merchant_id: merchantId },
      relations: ["provider", "attempts"],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async findAllForAdmin(
    page: number = 1,
    limit: number = 20,
    filters?: {
      merchantId?: number;
      providerId?: number;
      status?: TransactionStatus;
      type?: "deposit" | "withdrawal";
      startDate?: Date;
      endDate?: Date;
        sandbox?: boolean;
    },
  ) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.merchant", "merchant")
      .leftJoinAndSelect("transaction.provider", "provider")
      .orderBy("transaction.created_at", "DESC");

    if (filters?.merchantId) {
      qb.andWhere("transaction.merchant_id = :merchantId", {
        merchantId: filters.merchantId,
      });
    }
    if (filters?.providerId) {
      qb.andWhere("transaction.provider_id = :providerId", {
        providerId: filters.providerId,
      });
    }
    if (filters?.status) {
      qb.andWhere("transaction.status = :status", { status: filters.status });
    }
    if (filters?.type) {
      qb.andWhere("transaction.type = :type", { type: filters.type });
    }
    if (filters?.startDate) {
      qb.andWhere("transaction.created_at >= :startDate", {
        startDate: filters.startDate,
      });
    }
    if (filters?.endDate) {
      qb.andWhere("transaction.created_at <= :endDate", {
        endDate: filters.endDate,
      });
    }
    if (filters?.sandbox === true) {
      qb.andWhere("transaction.metadata LIKE :sandboxLike", {
        sandboxLike: SANDBOX_METADATA_LIKE,
      });
    }
    if (filters?.sandbox === false) {
      qb.andWhere(
        "(transaction.metadata IS NULL OR transaction.metadata NOT LIKE :sandboxLike)",
        {
          sandboxLike: SANDBOX_METADATA_LIKE,
        },
      );
    }

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByMerchant(
    merchantId: number,
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: TransactionStatus;
      type?: "deposit" | "withdrawal";
      sandbox?: boolean;
    },
  ) {
    const qb = this.transactionRepository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.provider", "provider")
      .where("transaction.merchant_id = :merchantId", { merchantId })
      .orderBy("transaction.created_at", "DESC");

    if (filters?.status) {
      qb.andWhere("transaction.status = :status", { status: filters.status });
    }
    if (filters?.type) {
      qb.andWhere("transaction.type = :type", { type: filters.type });
    }
    if (filters?.sandbox === true) {
      qb.andWhere("transaction.metadata LIKE :sandboxLike", {
        sandboxLike: SANDBOX_METADATA_LIKE,
      });
    }
    if (filters?.sandbox === false) {
      qb.andWhere(
        "(transaction.metadata IS NULL OR transaction.metadata NOT LIKE :sandboxLike)",
        {
          sandboxLike: SANDBOX_METADATA_LIKE,
        },
      );
    }

    const [transactions, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByProviderReferences(
    providerId: number,
    externalId?: string,
    referenceId?: string,
  ): Promise<Transaction | null> {
    if (!externalId && !referenceId) {
      return null;
    }

    return this.transactionRepository
      .createQueryBuilder("transaction")
      .where("transaction.provider_id = :providerId", { providerId })
      .andWhere(
        new Brackets((qb) => {
          if (externalId) {
            qb.orWhere("transaction.external_id = :externalId", { externalId });
          }
          if (referenceId) {
            qb.orWhere("transaction.reference_id = :referenceId", {
              referenceId,
            });
          }
        }),
      )
      .orderBy("transaction.id", "DESC")
      .getOne();
  }

  async updateStatus(
    id: number,
    status: TransactionStatus,
    externalId?: string,
    failureReason?: string,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id);
    const previousStatus = transaction.status;

    transaction.status = status;
    if (externalId) {
      transaction.external_id = externalId;
    }
    if (status === TransactionStatus.FAILED) {
      transaction.failure_reason = failureReason ?? transaction.failure_reason;
    } else if (failureReason !== undefined) {
      transaction.failure_reason = failureReason;
    } else {
      transaction.failure_reason = null;
    }

    const savedTransaction = await this.transactionRepository.save(transaction);

    if (previousStatus !== status) {
      const amountLabel = this.formatAmount(
        savedTransaction.amount,
        savedTransaction.currency,
      );
      const merchantName = transaction.merchant?.name ?? "Merchant";
      const statusLabel = status.toUpperCase();

      await Promise.all([
        this.notificationsService.createForMerchant(savedTransaction.merchant_id, {
          category: NotificationCategory.TRANSACTION,
          title: `Transaction ${statusLabel.toLowerCase()}`,
          message: `Transaction #${savedTransaction.id} is now ${statusLabel.toLowerCase()} for ${amountLabel}.`,
          metadata: {
            transactionId: savedTransaction.id,
            previousStatus,
            status,
            externalId: savedTransaction.external_id,
            failureReason: savedTransaction.failure_reason,
          },
        }),
        this.notificationsService.createForAllActiveAdmins({
          category: NotificationCategory.TRANSACTION,
          title: `Transaction ${statusLabel.toLowerCase()}`,
          message: `${merchantName} transaction #${savedTransaction.id} changed from ${previousStatus} to ${statusLabel.toLowerCase()}.`,
          metadata: {
            transactionId: savedTransaction.id,
            merchantId: savedTransaction.merchant_id,
            providerId: savedTransaction.provider_id,
            previousStatus,
            status,
            externalId: savedTransaction.external_id,
            failureReason: savedTransaction.failure_reason,
          },
        }),
      ]);
    }

    return savedTransaction;
  }

  async createAttempt(
    transactionId: number,
    request: any,
    response: any,
    status: AttemptStatus,
    errorMessage?: string,
  ): Promise<TransactionAttempt> {
    const attempt = this.attemptRepository.create({
      transaction_id: transactionId,
      provider_request: JSON.stringify(request),
      provider_response: JSON.stringify(response),
      status,
      error_message: errorMessage,
    });

    return this.attemptRepository.save(attempt);
  }

  async forceSandboxStatus(
    id: number,
    status: TransactionStatus,
    failureReason?: string,
  ) {
    const transaction = await this.findOne(id);
    if (!isSandboxTransaction(transaction.metadata)) {
      throw new BadRequestException(
        "Sandbox actions are only available for sandbox transactions",
      );
    }

    const updated = await this.updateStatus(
      id,
      status,
      transaction.external_id ?? `sandbox_tx_${transaction.id}`,
      failureReason,
    );

    if (
      status === TransactionStatus.SUCCEEDED ||
      status === TransactionStatus.FAILED ||
      status === TransactionStatus.REVERSED
    ) {
      await this.webhooksService.deliverMerchantWebhook(updated.id);
    }

    return updated;
  }

  async replaySandboxCallback(
    id: number,
    status: TransactionStatus = TransactionStatus.SUCCEEDED,
    message?: string,
  ) {
    const transaction = await this.findOne(id);
    if (!isSandboxTransaction(transaction.metadata)) {
      throw new BadRequestException(
        "Sandbox actions are only available for sandbox transactions",
      );
    }

    const provider =
      transaction.provider ?? (await this.providersService.findOne(transaction.provider_id));
    if (provider.name !== SANDBOX_PROVIDER_NAME) {
      throw new BadRequestException(
        "Replay callback is only supported for sandbox provider transactions",
      );
    }

    const sandbox = getSandboxConfig(transaction.metadata);
    const payload = {
      event: "transaction.updated",
      transaction_id: transaction.external_id ?? `sandbox_tx_${transaction.id}`,
      reference_id: transaction.reference_id ?? undefined,
      status,
      code: status,
      message:
        message ??
        (status === TransactionStatus.FAILED
          ? "Sandbox callback replay forced a failed transaction."
          : "Sandbox callback replay processed successfully."),
      sandbox_delivery_mode: sandbox?.sandbox_delivery_mode ?? "callback",
    };

    await this.webhooksService.handleProviderWebhook(
      provider.id,
      payload.event,
      payload,
    );

    return this.findOne(transaction.id);
  }
}
