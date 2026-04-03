import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, Repository } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "./entities/transaction.entity";
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
import { ProcessTransactionResponse } from "../providers/interfaces/provider.interface";
import {
  buildSandboxMetadata,
  getSandboxConfig,
  isSandboxTransaction,
  SANDBOX_METADATA_LIKE,
  SANDBOX_PROVIDER_NAME,
} from "./sandbox.utils";
import { MerchantTransactionResponse } from "./dto/merchant-transaction.dto";
import { PublicDepositInstructionsResponse } from "./dto/public-deposit-instructions.dto";
import { PayoutInquiryDto } from "./dto/payout-inquiry.dto";
import { MerchantPayoutInquiryResponse } from "./dto/merchant-payout-inquiry.response";
import type { DpayPayoutInquiryError } from "../providers/providers/dpay/dpay-payout-inquiry.types";
import { BalanceInquiryDto } from "./dto/balance-inquiry.dto";
import { MerchantBalanceInquiryResponse } from "./dto/merchant-balance-inquiry.response";
import type { DpayBalanceInquiryError } from "../providers/providers/dpay/dpay-balance-inquiry.types";
import { BankListDto } from "./dto/bank-list.dto";
import { MerchantBankListResponse } from "./dto/merchant-bank-list.response";
import type { DpayBankListError } from "../providers/providers/dpay/dpay-bank-list.types";

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private formatAmount(amount: number, currency: string) {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }

  private generatePublicToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private isSandboxEnabled() {
    const value = String(
      this.configService.get<string>("SANDBOX_MODE_ENABLED", "true"),
    ).toLowerCase();
    return value === "true" || value === "1" || value === "yes";
  }

  private async mergeTransactionMetadata(
    transactionId: number,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });
    if (!transaction) {
      return;
    }
    let meta: Record<string, unknown> = {};
    try {
      meta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    } catch {
      meta = {};
    }
    Object.assign(meta, patch);
    transaction.metadata = JSON.stringify(meta);
    await this.transactionRepository.save(transaction);
  }

  mapTransactionForMerchant(
    transaction: Transaction,
  ): MerchantTransactionResponse {
    let meta: Record<string, unknown> = {};
    try {
      meta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    } catch {
      meta = {};
    }
    const paymentDetails = meta.payment_details as
      | Record<string, unknown>
      | undefined;
    const paymentMeta = { ...meta };
    delete paymentMeta.payment_details;
    const providerErrorRaw = meta.provider_error as
      | { code?: string | number; message?: string }
      | undefined;
    delete paymentMeta.provider_error;

    return {
      id: transaction.id,
      merchant_id: transaction.merchant_id,
      public_token: transaction.public_token ?? undefined,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      reference_id: transaction.reference_id ?? undefined,
      external_id: transaction.external_id ?? undefined,
      status: transaction.status,
      failure_reason: transaction.failure_reason ?? undefined,
      metadata:
        Object.keys(paymentMeta).length > 0 ? paymentMeta : undefined,
      provider: transaction.provider
        ? {
            id: transaction.provider.id,
            name: transaction.provider.name,
            display_name: transaction.provider.display_name,
          }
        : undefined,
      payment:
        paymentDetails && typeof paymentDetails === "object"
          ? paymentDetails
          : undefined,
      provider_error:
        providerErrorRaw &&
        typeof providerErrorRaw === "object" &&
        (providerErrorRaw.code !== undefined || providerErrorRaw.message)
          ? {
              ...(providerErrorRaw.code !== undefined &&
              providerErrorRaw.code !== null
                ? { code: providerErrorRaw.code }
                : {}),
              ...(providerErrorRaw.message
                ? { message: String(providerErrorRaw.message) }
                : {}),
            }
          : undefined,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
  }

  private async hydrateIdempotentCachedResponse(
    merchantId: number,
    cached: unknown,
  ): Promise<MerchantTransactionResponse> {
    if (
      cached &&
      typeof cached === "object" &&
      cached !== null &&
      "id" in cached &&
      typeof (cached as { id: unknown }).id === "number"
    ) {
      const tx = await this.transactionRepository.findOne({
        where: {
          id: (cached as { id: number }).id,
          merchant_id: merchantId,
        },
        relations: ["provider"],
      });
      if (tx) {
        return this.mapTransactionForMerchant(tx);
      }
    }
    throw new NotFoundException("Cached transaction not found");
  }

  async applyProviderProcessingResult(
    transactionId: number,
    providerId: number,
    result: ProcessTransactionResponse,
  ): Promise<void> {
    const provider = await this.providersService.findOne(providerId);
    const providerService = this.providersService.getProviderService(
      provider.name,
    );

    if (result.success) {
      const normalizedStatus = result.status
        ? providerService.normalizeStatus(result.status)
        : result.paymentUrl
          ? "processing"
          : "succeeded";

      if (normalizedStatus === "succeeded") {
        await this.updateStatus(
          transactionId,
          TransactionStatus.SUCCEEDED,
          result.externalId,
        );
        await this.webhooksService.deliverMerchantWebhook(transactionId);
      } else if (normalizedStatus === "failed") {
        await this.updateStatus(
          transactionId,
          TransactionStatus.FAILED,
          result.externalId,
          result.error || "Provider returned failed status",
        );
        await this.webhooksService.deliverMerchantWebhook(transactionId);
      } else {
        await this.updateStatus(
          transactionId,
          TransactionStatus.PROCESSING,
          result.externalId,
        );

        if (result.callbackPayload) {
          const delayMs =
            result.callbackDelayMs && result.callbackDelayMs > 0
              ? result.callbackDelayMs
              : 0;
          await this.paymentQueue.add(
            "delayed-provider-callback",
            {
              transactionId,
              providerId,
              callbackPayload: result.callbackPayload,
            },
            { delay: delayMs },
          );
        }
      }
    } else {
      await this.updateStatus(
        transactionId,
        TransactionStatus.FAILED,
        undefined,
        result.error,
      );
      await this.webhooksService.deliverMerchantWebhook(transactionId);
    }
  }

  async create(
    merchantId: number,
    createTransactionDto: CreateTransactionDto,
  ): Promise<MerchantTransactionResponse> {
    if (createTransactionDto.idempotency_key) {
      const existing = await this.idempotencyService.getResponse(
        merchantId,
        createTransactionDto.idempotency_key,
      );
      if (existing) {
        return this.hydrateIdempotentCachedResponse(merchantId, existing);
      }
    }

    const merchant = await this.merchantsService.findOne(merchantId);

    if (!merchant.provider_id) {
      throw new BadRequestException(
        "Merchant does not have a provider assigned. Please assign a provider first.",
      );
    }

    const provider = await this.providersService.findOne(merchant.provider_id);

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

    const transaction = this.transactionRepository.create({
      merchant_id: merchantId,
      provider_id: provider.id,
      type: createTransactionDto.type,
      amount: createTransactionDto.amount,
      currency: createTransactionDto.currency || "USD",
      reference_id: createTransactionDto.reference_id,
      status: TransactionStatus.PENDING,
      public_token: this.generatePublicToken(),
      metadata: (() => {
        const metadata = buildSandboxMetadata(
          createTransactionDto.metadata,
          usesSandboxProvider ? createTransactionDto.sandbox ?? {} : undefined,
        );
        return metadata ? JSON.stringify(metadata) : null;
      })(),
    });

    const savedTransaction = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(transaction);
      if (saved.type === TransactionType.WITHDRAWAL) {
        await this.merchantsService.lockFundsForWithdrawal(
          manager,
          merchantId,
          Number(saved.amount),
          saved.currency,
        );
      }
      return saved;
    });

    const processMetadata =
      buildSandboxMetadata(
        createTransactionDto.metadata,
        usesSandboxProvider ? createTransactionDto.sandbox ?? {} : undefined,
      ) || {};

    const providerService = this.providersService.getProviderService(
      provider.name,
    );

    const result = await providerService.processTransaction({
      transactionId: savedTransaction.id,
      type: createTransactionDto.type,
      amount: createTransactionDto.amount,
      currency: savedTransaction.currency,
      metadata: processMetadata,
    });

    if (result.success) {
      if (result.paymentDetails) {
        await this.mergeTransactionMetadata(savedTransaction.id, {
          payment_details: result.paymentDetails,
        });
      } else if (result.paymentUrl) {
        await this.mergeTransactionMetadata(savedTransaction.id, {
          payment_details: { url: result.paymentUrl },
        });
      }
    } else {
      await this.mergeTransactionMetadata(savedTransaction.id, {
        provider_error: {
          ...(result.providerErrorCode !== undefined &&
          result.providerErrorCode !== null
            ? { code: result.providerErrorCode }
            : {}),
          message: String(
            result.providerErrorMessage ||
              result.error ||
              "Provider error",
          ),
        },
      });
    }

    await this.applyProviderProcessingResult(
      savedTransaction.id,
      provider.id,
      result,
    );

    await this.createAttempt(
      savedTransaction.id,
      {
        type: createTransactionDto.type,
        amount: createTransactionDto.amount,
      },
      result,
      result.success ? AttemptStatus.SUCCESS : AttemptStatus.FAILED,
      result.error,
    );

    const finalTx = await this.transactionRepository.findOne({
      where: { id: savedTransaction.id, merchant_id: merchantId },
      relations: ["provider"],
    });

    if (!finalTx) {
      throw new NotFoundException(
        `Transaction with ID ${savedTransaction.id} not found`,
      );
    }

    const response = this.mapTransactionForMerchant(finalTx);

    if (createTransactionDto.idempotency_key) {
      await this.idempotencyService.storeRequest(
        merchantId,
        createTransactionDto.idempotency_key,
        createTransactionDto,
        response as unknown as Record<string, unknown>,
      );
    }

    return response;
  }

  /**
   * Public payment page for deposits — keyed by unguessable `public_token` (no API key).
   */
  async getPublicDepositInstructions(
    token: string,
  ): Promise<PublicDepositInstructionsResponse> {
    const trimmed = (token || '').trim();
    if (!trimmed || trimmed.length < 32) {
      throw new NotFoundException();
    }

    const tx = await this.transactionRepository.findOne({
      where: { public_token: trimmed },
      relations: ['provider'],
    });

    if (!tx || tx.type !== TransactionType.DEPOSIT) {
      throw new NotFoundException();
    }

    const mapped = this.mapTransactionForMerchant(tx);
    const { merchant_id: _m, id, public_token: _pt, ...rest } = mapped;

    return {
      transaction_id: id,
      type: 'deposit',
      amount: rest.amount,
      currency: rest.currency,
      reference_id: rest.reference_id,
      external_id: rest.external_id,
      status: rest.status,
      failure_reason: rest.failure_reason,
      metadata: rest.metadata,
      provider: rest.provider,
      payment: rest.payment,
      provider_error: rest.provider_error,
      created_at: rest.created_at,
      updated_at: rest.updated_at,
    };
  }

  /**
   * DPay payout inquiry (merchant API). Proxies `Look/payment_order` with platform credentials.
   */
  async payoutInquiry(
    merchantId: number,
    dto: PayoutInquiryDto,
  ): Promise<MerchantPayoutInquiryResponse> {
    const merchant = await this.merchantsService.findOne(merchantId);
    if (!merchant.provider_id) {
      throw new BadRequestException(
        "Merchant does not have a provider assigned.",
      );
    }
    const provider = await this.providersService.findOne(merchant.provider_id);
    if (provider.name !== "dpay") {
      throw new BadRequestException(
        "Payout inquiry is only supported when your assigned provider is DPay.",
      );
    }

    let merchant_order = dto.merchant_order?.trim();
    let find_date = dto.find_date?.trim();

    if (dto.transaction_id != null) {
      const tx = await this.transactionRepository.findOne({
        where: { id: dto.transaction_id, merchant_id: merchantId },
      });
      if (!tx) {
        throw new NotFoundException(
          `Transaction with ID ${dto.transaction_id} not found`,
        );
      }
      if (tx.type !== TransactionType.WITHDRAWAL) {
        throw new BadRequestException(
          "Payout inquiry only applies to withdrawal transactions.",
        );
      }
      const meta = this.parseTxMetadata(tx.metadata);
      merchant_order =
        merchant_order || this.resolveWithdrawalMerchantOrder(tx, meta);
      find_date = find_date || this.formatFindDateForDpay(tx.created_at);
    }

    if (!merchant_order || !find_date) {
      throw new BadRequestException(
        "Provide transaction_id, or both merchant_order and find_date.",
      );
    }

    const result = await this.providersService.payoutInquiryDpay({
      merchant_order,
      find_date,
    });

    if (!result.success) {
      const err = result as DpayPayoutInquiryError;
      return {
        success: false,
        provider_error: {
          code: err.providerErrorCode,
          message: err.providerErrorMessage || err.message,
        },
        raw: err.raw,
      };
    }

    return {
      success: true,
      code: result.code,
      message: result.message,
      payout: result.payout,
    };
  }

  /**
   * DPay coin/balance inquiry (merchant API). Proxies DPay `Look/get_coin`
   * using the platform DPay credentials.
   */
  async balanceInquiry(
    merchantId: number,
    dto: BalanceInquiryDto,
  ): Promise<MerchantBalanceInquiryResponse> {
    const merchant = await this.merchantsService.findOne(merchantId);
    if (!merchant.provider_id) {
      throw new BadRequestException(
        "Merchant does not have a provider assigned.",
      );
    }

    const provider = await this.providersService.findOne(merchant.provider_id);
    if (provider.name !== "dpay") {
      throw new BadRequestException(
        "Balance inquiry is only supported when your assigned provider is DPay.",
      );
    }

    const find_date =
      dto.find_date?.trim() || this.formatFindDateForDpay(new Date());

    const result = await this.providersService.balanceInquiryDpay({
      find_date,
    });

    if (!result.success) {
      const err = result as DpayBalanceInquiryError;
      return {
        success: false,
        provider_error: {
          code: err.providerErrorCode,
          message: err.providerErrorMessage || err.message,
        },
        raw: err.raw,
      };
    }

    return {
      success: true,
      code: result.code,
      message: result.message,
      merchant_num: result.merchant_num,
      coin: result.coin,
      fcoin: result.fcoin,
    };
  }

  /**
   * DPay bank/channel list (CDC M) (merchant API).
   * Proxies DPay `/index/bank_list` using platform credentials.
   */
  async bankList(
    merchantId: number,
    dto: BankListDto,
  ): Promise<MerchantBankListResponse> {
    const merchant = await this.merchantsService.findOne(merchantId);
    if (!merchant.provider_id) {
      throw new BadRequestException("Merchant does not have a provider assigned.");
    }

    const provider = await this.providersService.findOne(merchant.provider_id);
    if (provider.name !== "dpay") {
      throw new BadRequestException(
        "Bank list inquiry is only supported when your assigned provider is DPay.",
      );
    }

    const result = await this.providersService.bankListDpay({
      pay_type: dto.pay_type,
    });

    if (!result.success) {
      const err = result as DpayBankListError;
      return {
        success: false,
        provider_error: {
          code: err.providerErrorCode,
          message: err.providerErrorMessage || err.message,
        },
        raw: err.raw,
      };
    }

    return {
      success: true,
      code: result.code,
      message: result.message,
      data: result.data,
    };
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
  ): Promise<MerchantTransactionResponse> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, merchant_id: merchantId },
      relations: ["provider", "attempts"],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return this.mapTransactionForMerchant(transaction);
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
      data: transactions.map((t) => this.mapTransactionForMerchant(t)),
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
    const { savedTransaction, previousStatus, merchantName } =
      await this.dataSource.transaction(async (manager) => {
        const transaction = await manager.findOne(Transaction, {
          where: { id },
          relations: ["merchant"],
          lock: { mode: "pessimistic_write" },
        });

        if (!transaction) {
          throw new NotFoundException(`Transaction with ID ${id} not found`);
        }

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

        const savedTransaction = await manager.save(transaction);

        if (previousStatus !== status) {
          await this.merchantsService.applyLedgerForStatusChange(
            manager,
            savedTransaction,
            previousStatus,
            status,
          );
        }

        const merchantName = transaction.merchant?.name ?? "Merchant";

        return { savedTransaction, previousStatus, merchantName };
      });

    if (previousStatus !== status) {
      const amountLabel = this.formatAmount(
        savedTransaction.amount,
        savedTransaction.currency,
      );
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

  private parseTxMetadata(raw: string | null): Record<string, unknown> {
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private resolveWithdrawalMerchantOrder(
    tx: Transaction,
    meta: Record<string, unknown>,
  ): string {
    const order = meta.order ?? meta.merchant_order ?? meta.m_order;
    const resolved = String(order ?? "").trim();
    return resolved || `tx_${tx.id}`;
  }

  /** Match DPay `formatDate` timezone (+7) for find_date. */
  private formatFindDateForDpay(date: Date): string {
    const shift = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const y = shift.getUTCFullYear();
    const m = String(shift.getUTCMonth() + 1).padStart(2, "0");
    const d = String(shift.getUTCDate()).padStart(2, "0");
    const h = String(shift.getUTCHours()).padStart(2, "0");
    const min = String(shift.getUTCMinutes()).padStart(2, "0");
    const s = String(shift.getUTCSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
}
