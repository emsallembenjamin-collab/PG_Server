import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, In, Repository } from 'typeorm';
import { Admin, AdminStatus } from '../admins/entities/admin.entity';
import { Currency, CurrencyStatus } from '../currencies/entities/currency.entity';
import { CurrencyRate } from '../currencies/entities/currency-rate.entity';
import { IdempotencyKey } from '../idempotency/entities/idempotency-key.entity';
import {
  ApiKeyStatus,
  MerchantApiKey,
} from '../merchants/entities/merchant-api-key.entity';
import { MerchantConfig } from '../merchants/entities/merchant-config.entity';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import {
  Notification,
  NotificationCategory,
  NotificationRecipientType,
} from '../notifications/entities/notification.entity';
import { Provider, ProviderStatus } from '../providers/entities/provider.entity';
import {
  DiscrepancyStatus,
  DiscrepancyType,
  ReconciliationDiscrepancy,
} from '../reconciliation/entities/reconciliation-discrepancy.entity';
import {
  Reconciliation,
  ReconciliationStatus,
  ReconciliationType,
} from '../reconciliation/entities/reconciliation.entity';
import {
  AttemptStatus,
  TransactionAttempt,
} from '../transactions/entities/transaction-attempt.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { buildSandboxMetadata, SANDBOX_PROVIDER_NAME } from '../transactions/sandbox.utils';
import { WebhookDelivery, WebhookDeliveryStatus } from '../webhooks/entities/webhook-delivery.entity';
import { WebhookEvent } from '../webhooks/entities/webhook-event.entity';

const SEED_TAG = 'seed-fake-data-v1';
const SEED_MERCHANT_EMAILS = [
  'sandbox.alpha@seed.goldpay.local',
  'merchant.beta@seed.goldpay.local',
  'merchant.gamma@seed.goldpay.local',
];
const LEGACY_SEED_MERCHANT_EMAILS = ['merchant.alpha@seed.goldpay.local'];
const SEED_PROVIDER_NAMES = [SANDBOX_PROVIDER_NAME, 'seed_gateway_alpha', 'seed_gateway_beta'];
const SEED_API_KEYS = [
  'gpk_sandbox_merchant_alpha_001',
  'gpk_seed_merchant_beta_001',
  'gpk_seed_merchant_gamma_001',
];
const SEED_CHANNELS = ['Google', 'Facebook', 'Github', 'X.com', 'Vimeo'];
const SEED_DEVICES = ['Desktop', 'Mobile', 'Tablet', 'Unknown'];
const SEED_ADMINS = [
  {
    email: 'admin@goldpay.local',
    password: 'admin123',
    name: 'GoldPay Admin',
    status: AdminStatus.ACTIVE,
  },
  {
    email: 'ops@goldpay.local',
    password: 'ops123',
    name: 'Operations Admin',
    status: AdminStatus.ACTIVE,
  },
];

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadProjectEnv() {
  const root = path.resolve(__dirname, '..', '..');
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));
}

function makeHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function amountForIndex(index: number) {
  return Number((75 + index * 32.5).toFixed(2));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function buildTransactionTimestamp(monthOffset: number, slotIndex: number, merchantOffset: number) {
  if (monthOffset === 0) {
    const date = daysAgo(slotIndex * 2 + merchantOffset);
    date.setHours(10 + ((slotIndex + merchantOffset) % 8), 15, 0, 0);
    return date;
  }

  const date = new Date();
  date.setHours(9 + ((slotIndex + merchantOffset) % 9), 30, 0, 0);
  date.setDate(18 - ((slotIndex * 3 + merchantOffset) % 10));
  date.setMonth(date.getMonth() - monthOffset);
  return date;
}

function slotsForMonth(monthOffset: number) {
  if (monthOffset < 3) {
    return 4;
  }

  if (monthOffset < 12) {
    return 2;
  }

  return 1;
}

function buildSummary(transactions: Transaction[]) {
  const summary = {
    total_transactions: transactions.length,
    total_amount: 0,
    succeeded_count: 0,
    succeeded_amount: 0,
    failed_count: 0,
    failed_amount: 0,
    pending_count: 0,
    pending_amount: 0,
  };

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    summary.total_amount += amount;

    if (tx.status === TransactionStatus.SUCCEEDED) {
      summary.succeeded_count += 1;
      summary.succeeded_amount += amount;
    } else if (tx.status === TransactionStatus.FAILED || tx.status === TransactionStatus.REVERSED) {
      summary.failed_count += 1;
      summary.failed_amount += amount;
    } else {
      summary.pending_count += 1;
      summary.pending_amount += amount;
    }
  }

  return {
    ...summary,
    total_amount: Number(summary.total_amount.toFixed(2)),
    succeeded_amount: Number(summary.succeeded_amount.toFixed(2)),
    failed_amount: Number(summary.failed_amount.toFixed(2)),
    pending_amount: Number(summary.pending_amount.toFixed(2)),
  };
}

async function upsertCurrency(
  repo: Repository<Currency>,
  payload: Partial<Currency> & Pick<Currency, 'code' | 'name'>,
) {
  const existing = await repo.findOne({ where: { code: payload.code } });
  return repo.save(repo.create({ ...existing, ...payload }));
}

async function upsertProvider(
  repo: Repository<Provider>,
  payload: Partial<Provider> & Pick<Provider, 'name' | 'display_name'>,
) {
  const existing = await repo.findOne({ where: { name: payload.name } });
  return repo.save(repo.create({ ...existing, ...payload }));
}

async function cleanupPreviousSeed(dataSource: DataSource) {
  const adminRepo = dataSource.getRepository(Admin);
  const merchantRepo = dataSource.getRepository(Merchant);
  const notificationRepo = dataSource.getRepository(Notification);
  const providerRepo = dataSource.getRepository(Provider);
  const transactionRepo = dataSource.getRepository(Transaction);
  const attemptRepo = dataSource.getRepository(TransactionAttempt);
  const reconciliationRepo = dataSource.getRepository(Reconciliation);
  const discrepancyRepo = dataSource.getRepository(ReconciliationDiscrepancy);
  const webhookDeliveryRepo = dataSource.getRepository(WebhookDelivery);
  const webhookEventRepo = dataSource.getRepository(WebhookEvent);
  const idempotencyRepo = dataSource.getRepository(IdempotencyKey);
  const merchantConfigRepo = dataSource.getRepository(MerchantConfig);
  const apiKeyRepo = dataSource.getRepository(MerchantApiKey);

  const seededMerchants = await merchantRepo.find({
    where: [...SEED_MERCHANT_EMAILS, ...LEGACY_SEED_MERCHANT_EMAILS].map((email) => ({ email })),
  });
  const seededProviders = await providerRepo.find({
    where: SEED_PROVIDER_NAMES.map((name) => ({ name })),
  });
  const seededAdmins = await adminRepo.find({
    where: SEED_ADMINS.map((admin) => ({ email: admin.email })),
  });

  const adminIds = seededAdmins.map((admin) => admin.id);
  const merchantIds = seededMerchants.map((merchant) => merchant.id);
  const providerIds = seededProviders.map((provider) => provider.id);

  if (adminIds.length > 0) {
    await notificationRepo.delete({
      recipient_type: NotificationRecipientType.ADMIN,
      admin_id: In(adminIds),
    });
  }

  if (merchantIds.length > 0) {
    await notificationRepo.delete({
      recipient_type: NotificationRecipientType.MERCHANT,
      merchant_id: In(merchantIds),
    });
  }

  if (merchantIds.length > 0) {
    const transactions = await transactionRepo.find({
      where: merchantIds.map((merchantId) => ({ merchant_id: merchantId })),
    });
    const transactionIds = transactions.map((transaction) => transaction.id);

    if (transactionIds.length > 0) {
      await webhookDeliveryRepo.delete({ transaction_id: In(transactionIds) });
      await attemptRepo.delete({ transaction_id: In(transactionIds) });
      await discrepancyRepo.delete({ transaction_id: In(transactionIds) });
    }

    await idempotencyRepo
      .createQueryBuilder()
      .delete()
      .where('merchant_id IN (:...merchantIds)', { merchantIds })
      .andWhere('`key` LIKE :keyPrefix', { keyPrefix: 'seed-%' })
      .execute();

    await merchantConfigRepo.delete({ merchant_id: In(merchantIds) });
    await apiKeyRepo.delete({ merchant_id: In(merchantIds) });

    const reconciliations = await reconciliationRepo.find({
      where: [
        ...merchantIds.map((merchantId) => ({ merchant_id: merchantId })),
        ...providerIds.map((providerId) => ({ provider_id: providerId })),
      ],
    });
    const reconciliationIds = reconciliations.map((row) => row.id);
    if (reconciliationIds.length > 0) {
      await discrepancyRepo.delete({ reconciliation_id: In(reconciliationIds) });
      await reconciliationRepo.delete(reconciliationIds);
    }

    await transactionRepo.delete({ merchant_id: In(merchantIds) });
    await merchantRepo.delete({ id: In(merchantIds) });
  }

  if (providerIds.length > 0) {
    await webhookEventRepo
      .createQueryBuilder()
      .delete()
      .where('provider_id IN (:...providerIds)', { providerIds })
      .andWhere('transaction_ref LIKE :prefix', { prefix: 'seed-%' })
      .execute();
  }

  if (adminIds.length > 0) {
    await adminRepo.delete({ id: In(adminIds) });
  }
}

async function seed() {
  loadProjectEnv();

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    // Seed flow is intended for local/dev bootstrap.
    // Enable synchronize so tables are created before inserting fake data.
    synchronize: true,
    entities: [
      Admin,
      Currency,
      CurrencyRate,
      IdempotencyKey,
      Merchant,
      MerchantApiKey,
      MerchantConfig,
      Notification,
      Provider,
      Reconciliation,
      ReconciliationDiscrepancy,
      Transaction,
      TransactionAttempt,
      WebhookEvent,
      WebhookDelivery,
    ],
  });

  await dataSource.initialize();

  try {
    await cleanupPreviousSeed(dataSource);

    const adminRepo = dataSource.getRepository(Admin);
    const currencyRepo = dataSource.getRepository(Currency);
    const rateRepo = dataSource.getRepository(CurrencyRate);
    const providerRepo = dataSource.getRepository(Provider);
    const merchantRepo = dataSource.getRepository(Merchant);
    const notificationRepo = dataSource.getRepository(Notification);
    const merchantConfigRepo = dataSource.getRepository(MerchantConfig);
    const apiKeyRepo = dataSource.getRepository(MerchantApiKey);
    const transactionRepo = dataSource.getRepository(Transaction);
    const attemptRepo = dataSource.getRepository(TransactionAttempt);
    const idempotencyRepo = dataSource.getRepository(IdempotencyKey);
    const webhookEventRepo = dataSource.getRepository(WebhookEvent);
    const webhookDeliveryRepo = dataSource.getRepository(WebhookDelivery);
    const reconciliationRepo = dataSource.getRepository(Reconciliation);
    const discrepancyRepo = dataSource.getRepository(ReconciliationDiscrepancy);

    const admins = await Promise.all(
      SEED_ADMINS.map(async (seedAdmin) => {
        const password_hash = await bcrypt.hash(seedAdmin.password, 10);
        return adminRepo.save(
          adminRepo.create({
            email: seedAdmin.email,
            password_hash,
            name: seedAdmin.name,
            status: seedAdmin.status,
          }),
        );
      }),
    );

    const usd = await upsertCurrency(currencyRepo, {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimal_places: 2,
      status: CurrencyStatus.ACTIVE,
      config: JSON.stringify({ seed: SEED_TAG, locale: 'en-US' }),
    });
    const eur = await upsertCurrency(currencyRepo, {
      code: 'EUR',
      name: 'Euro',
      symbol: 'EUR',
      decimal_places: 2,
      status: CurrencyStatus.ACTIVE,
      config: JSON.stringify({ seed: SEED_TAG, locale: 'de-DE' }),
    });
    const vnd = await upsertCurrency(currencyRepo, {
      code: 'VND',
      name: 'Vietnamese Dong',
      symbol: 'VND',
      decimal_places: 0,
      status: CurrencyStatus.ACTIVE,
      config: JSON.stringify({ seed: SEED_TAG, locale: 'vi-VN' }),
    });

    const ratePairs = [
      { from: usd.id, to: eur.id, rate: 0.92 },
      { from: eur.id, to: usd.id, rate: 1.087 },
      { from: usd.id, to: vnd.id, rate: 24850 },
      { from: vnd.id, to: usd.id, rate: 0.00004024 },
      { from: eur.id, to: vnd.id, rate: 27050 },
      { from: vnd.id, to: eur.id, rate: 0.00003697 },
    ];

    for (const pair of ratePairs) {
      const existing = await rateRepo.findOne({
        where: {
          from_currency_id: pair.from,
          to_currency_id: pair.to,
        },
      });
      await rateRepo.save(
        rateRepo.create({
          ...existing,
          from_currency_id: pair.from,
          to_currency_id: pair.to,
          rate: pair.rate,
          reverse_rate: Number((1 / pair.rate).toFixed(8)),
          expires_at: daysAgo(-7),
        }),
      );
    }

    const providers = await Promise.all([
      upsertProvider(providerRepo, {
        name: SANDBOX_PROVIDER_NAME,
        display_name: 'Sandbox Simulator',
        status: ProviderStatus.ACTIVE,
        priority: 5,
        fee_percentage: 0,
        min_amount: 1,
        max_amount: 50000,
        config: JSON.stringify({ seed: SEED_TAG, mode: 'sandbox', secret_env: 'SANDBOX_WEBHOOK_SECRET' }),
      }),
      upsertProvider(providerRepo, {
        name: 'seed_gateway_alpha',
        display_name: 'Seed Gateway Alpha',
        status: ProviderStatus.ACTIVE,
        priority: 10,
        fee_percentage: 2.25,
        min_amount: 10,
        max_amount: 5000,
        config: JSON.stringify({ seed: SEED_TAG, channel: 'sandbox-alpha' }),
      }),
      upsertProvider(providerRepo, {
        name: 'seed_gateway_beta',
        display_name: 'Seed Gateway Beta',
        status: ProviderStatus.ACTIVE,
        priority: 20,
        fee_percentage: 1.75,
        min_amount: 20,
        max_amount: 10000,
        config: JSON.stringify({ seed: SEED_TAG, channel: 'sandbox-beta' }),
      }),
    ]);

    const merchants = await merchantRepo.save([
      merchantRepo.create({
        name: 'Sandbox Merchant Alpha',
        email: SEED_MERCHANT_EMAILS[0],
        status: MerchantStatus.ACTIVE,
        webhook_url: 'https://sandbox.example.com/webhooks/alpha',
        webhook_secret: 'sandbox-alpha-secret',
        provider_id: providers[0].id,
      }),
      merchantRepo.create({
        name: 'Seed Merchant Beta',
        email: SEED_MERCHANT_EMAILS[1],
        status: MerchantStatus.ACTIVE,
        webhook_url: 'https://seed.example.com/webhooks/beta',
        webhook_secret: 'seed-beta-secret',
        provider_id: providers[2].id,
      }),
      merchantRepo.create({
        name: 'Seed Merchant Gamma',
        email: SEED_MERCHANT_EMAILS[2],
        status: MerchantStatus.SUSPENDED,
        webhook_url: 'https://seed.example.com/webhooks/gamma',
        webhook_secret: 'seed-gamma-secret',
        provider_id: providers[1].id,
      }),
    ]);

    const merchantConfigs: MerchantConfig[] = [];
    for (const merchant of merchants) {
      merchantConfigs.push(
        merchantConfigRepo.create({
          merchant_id: merchant.id,
          key: 'allowed_currencies',
          value: JSON.stringify(merchant.email.includes('gamma') ? ['USD'] : ['USD', 'EUR', 'VND']),
          plugin_name: 'default',
          metadata: JSON.stringify({ seed: SEED_TAG }),
        }),
        merchantConfigRepo.create({
          merchant_id: merchant.id,
          key: 'webhook_retry_count',
          value: JSON.stringify(merchant.email.includes('beta') ? 5 : 3),
          plugin_name: 'default',
          metadata: JSON.stringify({ seed: SEED_TAG }),
        }),
        merchantConfigRepo.create({
          merchant_id: merchant.id,
          key: 'fee_structure',
          value: JSON.stringify({
            deposit: merchant.email.includes('beta') ? 1.9 : 2.1,
            withdrawal: merchant.email.includes('gamma') ? 2.6 : 2.3,
          }),
          plugin_name: 'default',
          metadata: JSON.stringify({ seed: SEED_TAG }),
        }),
      );
    }
    await merchantConfigRepo.save(merchantConfigs);

    await apiKeyRepo.delete({ merchant_id: In(merchants.map((merchant) => merchant.id)) });

    await apiKeyRepo
      .createQueryBuilder()
      .insert()
      .into(MerchantApiKey)
      .values(
        merchants.map((merchant, index) => ({
          merchant_id: merchant.id,
          key_hash: makeHash(SEED_API_KEYS[index]),
          status: index === 2 ? ApiKeyStatus.REVOKED : ApiKeyStatus.ACTIVE,
          name: `Seed API Key ${index + 1}`,
        })),
      )
      .execute();

    const apiKeys = await apiKeyRepo.find({
      where: { merchant_id: In(merchants.map((merchant) => merchant.id)) },
      order: { merchant_id: 'ASC' },
    });

    await notificationRepo.save(
      admins.flatMap((admin) => [
        notificationRepo.create({
          recipient_type: NotificationRecipientType.ADMIN,
          admin_id: admin.id,
          category: NotificationCategory.ACCOUNT,
          title: 'Admin account signed in',
          message: `Welcome back ${admin.name}. Your seeded environment is ready.`,
          metadata: JSON.stringify({ seed: SEED_TAG }),
          is_read: false,
          read_at: null,
        }),
        notificationRepo.create({
          recipient_type: NotificationRecipientType.ADMIN,
          admin_id: admin.id,
          category: NotificationCategory.RECONCILIATION,
          title: 'Reconciliation summary requires review',
          message:
            'One seeded reconciliation run contains discrepancies and needs your action.',
          metadata: JSON.stringify({ seed: SEED_TAG, severity: 'medium' }),
          is_read: false,
          read_at: null,
        }),
        notificationRepo.create({
          recipient_type: NotificationRecipientType.ADMIN,
          admin_id: admin.id,
          category: NotificationCategory.SYSTEM,
          title: 'System maintenance notice',
          message: 'Seeded maintenance window scheduled in 48 hours.',
          metadata: JSON.stringify({ seed: SEED_TAG }),
          is_read: true,
          read_at: new Date(),
        }),
      ]),
    );

    await notificationRepo.save(
      merchants.flatMap((merchant) => [
        notificationRepo.create({
          recipient_type: NotificationRecipientType.MERCHANT,
          merchant_id: merchant.id,
          category: NotificationCategory.TRANSACTION,
          title: 'New transaction update',
          message: `Merchant ${merchant.name} has new seeded transaction updates available.`,
          metadata: JSON.stringify({ seed: SEED_TAG }),
          is_read: false,
          read_at: null,
        }),
        notificationRepo.create({
          recipient_type: NotificationRecipientType.MERCHANT,
          merchant_id: merchant.id,
          category: NotificationCategory.WEBHOOK,
          title: 'Webhook delivery retry',
          message: 'One webhook delivery failed and is queued for retry.',
          metadata: JSON.stringify({ seed: SEED_TAG }),
          is_read: false,
          read_at: null,
        }),
        notificationRepo.create({
          recipient_type: NotificationRecipientType.MERCHANT,
          merchant_id: merchant.id,
          category: NotificationCategory.SECURITY,
          title: 'API key activity detected',
          message: 'Your seeded API key was used from a new environment.',
          metadata: JSON.stringify({ seed: SEED_TAG }),
          is_read: merchant.status === MerchantStatus.SUSPENDED,
          read_at: merchant.status === MerchantStatus.SUSPENDED ? new Date() : null,
        }),
      ]),
    );

    const transactionsToCreate: Transaction[] = [];
    const transactionDates: Date[] = [];
    let txIndex = 0;
    for (const [merchantIndex, merchant] of merchants.entries()) {
      for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
        for (let slotIndex = 0; slotIndex < slotsForMonth(monthOffset); slotIndex += 1) {
          txIndex += 1;

          const statusCycle = [
            TransactionStatus.SUCCEEDED,
            TransactionStatus.SUCCEEDED,
            TransactionStatus.PROCESSING,
            TransactionStatus.PENDING,
            TransactionStatus.FAILED,
            TransactionStatus.REVERSED,
          ];
          const currencyCycle = ['USD', 'EUR', 'VND'];
          const typeCycle = [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL];
          const status = statusCycle[(txIndex + merchantIndex + slotIndex) % statusCycle.length];
          const currency = currencyCycle[(txIndex + monthOffset) % currencyCycle.length];
          const type = typeCycle[(txIndex + slotIndex) % typeCycle.length];
          const amount = Number(
            (
              amountForIndex(txIndex) +
              monthOffset * 18 +
              slotIndex * 11 +
              merchantIndex * 25
            ).toFixed(2),
          );
          const channel = SEED_CHANNELS[(txIndex + merchantIndex) % SEED_CHANNELS.length];
          const device = SEED_DEVICES[(txIndex + slotIndex) % SEED_DEVICES.length];
          const visitors = 95 + ((txIndex + monthOffset * 7 + merchantIndex * 11) % 180);
          const feeAmount =
            status === TransactionStatus.SUCCEEDED
              ? Number(
                  (
                    amount *
                    (merchant.provider_id === providers[0].id ? 0.024 : merchantIndex === 1 ? 0.019 : 0.021)
                  ).toFixed(2),
                )
              : 0;
          const createdAt = buildTransactionTimestamp(monthOffset, slotIndex, merchantIndex);

          transactionsToCreate.push(
            transactionRepo.create({
              merchant_id: merchant.id,
              provider_id: merchant.provider_id,
              type,
              amount,
              currency,
              status,
              external_id: `seed-ext-${txIndex}`,
              reference_id: `seed-ref-${merchant.id}-${txIndex}`,
              metadata: JSON.stringify(
                buildSandboxMetadata(
                  {
                    seed: SEED_TAG,
                    orderId: `ORD-${merchant.id}-${txIndex}`,
                    customerEmail: merchant.email,
                    dashboard: {
                      channel,
                      device,
                      visitors,
                      fee_amount: feeAmount,
                    },
                  },
                  merchant.email.includes('sandbox')
                    ? {
                        outcome:
                          status === TransactionStatus.FAILED
                            ? 'processing_then_failed'
                            : status === TransactionStatus.REVERSED
                              ? 'failed'
                              : 'processing_then_success',
                        delivery_mode: 'callback',
                        delay_ms: 1200 + slotIndex * 150,
                      }
                    : undefined,
                ),
              ),
              failure_reason:
                status === TransactionStatus.FAILED
                  ? 'Seeded provider rejection'
                  : status === TransactionStatus.REVERSED
                    ? 'Seeded reversal after review'
                    : null,
            }),
          );
          transactionDates.push(createdAt);
        }
      }
    }
    const transactions = await transactionRepo.save(transactionsToCreate);

    await Promise.all(
      transactions.map((transaction, index) =>
        transactionRepo.update(transaction.id, {
          created_at: transactionDates[index] as any,
          updated_at: transactionDates[index] as any,
        }),
      ),
    );

    const attemptsToCreate: TransactionAttempt[] = [];
    for (const transaction of transactions) {
      attemptsToCreate.push(
        attemptRepo.create({
          transaction_id: transaction.id,
          provider_request: JSON.stringify({
            seed: SEED_TAG,
            provider_id: transaction.provider_id,
            amount: transaction.amount,
            currency: transaction.currency,
          }),
          provider_response: JSON.stringify({
            seed: SEED_TAG,
            status: transaction.status,
            external_id: transaction.external_id,
          }),
          status:
            transaction.status === TransactionStatus.SUCCEEDED
              ? AttemptStatus.SUCCESS
              : transaction.status === TransactionStatus.FAILED
                ? AttemptStatus.FAILED
                : AttemptStatus.PENDING,
          error_message:
            transaction.status === TransactionStatus.FAILED ? 'Seeded attempt failure' : null,
        }),
      );

      if (transaction.status === TransactionStatus.REVERSED) {
        attemptsToCreate.push(
          attemptRepo.create({
            transaction_id: transaction.id,
            provider_request: JSON.stringify({ seed: SEED_TAG, action: 'reversal' }),
            provider_response: JSON.stringify({ seed: SEED_TAG, final_status: 'reversed' }),
            status: AttemptStatus.SUCCESS,
            error_message: null,
          }),
        );
      }
    }
    await attemptRepo.save(attemptsToCreate);

    await idempotencyRepo.save(
      merchants.flatMap((merchant, index) => [
        idempotencyRepo.create({
          merchant_id: merchant.id,
          key: `seed-${merchant.id}-create-payment`,
          request_hash: makeHash(`seed-request-${merchant.id}-1`),
          response_payload: JSON.stringify({
            seed: SEED_TAG,
            merchantId: merchant.id,
            transactionReference: `seed-ref-${merchant.id}-${index + 1}`,
          }),
        }),
        idempotencyRepo.create({
          merchant_id: merchant.id,
          key: `seed-${merchant.id}-create-payout`,
          request_hash: makeHash(`seed-request-${merchant.id}-2`),
          response_payload: JSON.stringify({
            seed: SEED_TAG,
            merchantId: merchant.id,
            status: 'accepted',
          }),
        }),
      ]),
    );

    await webhookEventRepo.save(
      transactions.slice(0, 6).map((transaction) =>
        webhookEventRepo.create({
          provider_id: transaction.provider_id,
          event_type:
            transaction.type === TransactionType.DEPOSIT
              ? 'payment.updated'
              : 'payout.updated',
          payload: JSON.stringify({
            seed: SEED_TAG,
            transactionId: transaction.id,
            status: transaction.status,
          }),
          transaction_ref: `seed-webhook-${transaction.id}`,
        }),
      ),
    );

    await webhookDeliveryRepo.save(
      transactions.slice(0, 8).map((transaction, index) =>
        webhookDeliveryRepo.create({
          merchant_id: transaction.merchant_id,
          transaction_id: transaction.id,
          url: `${merchants.find((merchant) => merchant.id === transaction.merchant_id)?.webhook_url}`,
          payload: JSON.stringify({
            seed: SEED_TAG,
            transactionId: transaction.id,
            transactionStatus: transaction.status,
          }),
          status:
            index % 3 === 0
              ? WebhookDeliveryStatus.FAILED
              : index % 2 === 0
                ? WebhookDeliveryStatus.PENDING
                : WebhookDeliveryStatus.SUCCESS,
          attempt_count: (index % 3) + 1,
          last_attempt_at: daysAgo(index),
          last_error: index % 3 === 0 ? 'Seeded webhook timeout' : null,
        }),
      ),
    );

    const reconciliations: Reconciliation[] = [];
    for (const merchant of merchants) {
      const merchantTransactions = transactions.filter((tx) => tx.merchant_id === merchant.id);
      const summary = buildSummary(merchantTransactions);
      reconciliations.push(
        reconciliationRepo.create({
          type: ReconciliationType.MERCHANT,
          status:
            merchant.email.includes('beta')
              ? ReconciliationStatus.DISCREPANCY
              : ReconciliationStatus.COMPLETED,
          reconciliation_date: daysAgo(1),
          merchant_id: merchant.id,
          provider_id: merchant.provider_id,
          discrepancy_count: merchant.email.includes('beta') ? 1 : 0,
          notes: `Seed dataset merchant reconciliation for ${merchant.name}`,
          metadata: JSON.stringify({ seed: SEED_TAG, scope: 'merchant' }),
          ...summary,
        }),
      );
    }

    for (const provider of providers) {
      const providerTransactions = transactions.filter((tx) => tx.provider_id === provider.id);
      const summary = buildSummary(providerTransactions);
      reconciliations.push(
        reconciliationRepo.create({
          type: ReconciliationType.PROVIDER,
          status:
            provider.name === 'seed_gateway_beta'
              ? ReconciliationStatus.IN_PROGRESS
              : ReconciliationStatus.COMPLETED,
          reconciliation_date: daysAgo(1),
          merchant_id: null,
          provider_id: provider.id,
          discrepancy_count: provider.name === 'seed_gateway_beta' ? 1 : 0,
          notes: `Seed dataset provider reconciliation for ${provider.display_name}`,
          metadata: JSON.stringify({ seed: SEED_TAG, scope: 'provider' }),
          ...summary,
        }),
      );
    }

    reconciliations.push(
      reconciliationRepo.create({
        type: ReconciliationType.DAILY,
        status: ReconciliationStatus.DISCREPANCY,
        reconciliation_date: daysAgo(0),
        merchant_id: null,
        provider_id: null,
        discrepancy_count: 2,
        notes: 'Seed dataset daily reconciliation',
        metadata: JSON.stringify({ seed: SEED_TAG, scope: 'daily' }),
        ...buildSummary(transactions),
      }),
    );

    const savedReconciliations = await reconciliationRepo.save(reconciliations);
    const betaMerchantReconciliation = savedReconciliations.find(
      (row) => row.merchant_id === merchants[1].id && row.type === ReconciliationType.MERCHANT,
    );
    const dailyReconciliation = savedReconciliations.find(
      (row) => row.type === ReconciliationType.DAILY,
    );

    const discrepancies: ReconciliationDiscrepancy[] = [];
    if (betaMerchantReconciliation) {
      const failedTransaction = transactions.find(
        (tx) => tx.merchant_id === merchants[1].id && tx.status === TransactionStatus.FAILED,
      );
      discrepancies.push(
        discrepancyRepo.create({
          reconciliation_id: betaMerchantReconciliation.id,
          transaction_id: failedTransaction?.id ?? null,
          type: DiscrepancyType.STATUS_MISMATCH,
          status: DiscrepancyStatus.OPEN,
          description: 'Seeded merchant/provider status mismatch',
          expected_value: JSON.stringify({ providerStatus: 'processing' }),
          actual_value: JSON.stringify({ platformStatus: 'failed' }),
          resolution_notes: null,
          resolved_at: null,
          resolved_by: null,
        }),
      );
    }

    if (dailyReconciliation) {
      const pendingTransaction = transactions.find(
        (tx) => tx.status === TransactionStatus.PENDING,
      );
      discrepancies.push(
        discrepancyRepo.create({
          reconciliation_id: dailyReconciliation.id,
          transaction_id: pendingTransaction?.id ?? null,
          type: DiscrepancyType.AMOUNT_MISMATCH,
          status: DiscrepancyStatus.RESOLVED,
          description: 'Seeded amount mismatch resolved by admin',
          expected_value: JSON.stringify({ amount: 250 }),
          actual_value: JSON.stringify({ amount: pendingTransaction?.amount }),
          resolution_notes: 'Adjusted seeded settlement amount',
          resolved_at: new Date(),
          resolved_by: 1,
        }),
      );
      discrepancies.push(
        discrepancyRepo.create({
          reconciliation_id: dailyReconciliation.id,
          transaction_id: null,
          type: DiscrepancyType.MISSING_TRANSACTION,
          status: DiscrepancyStatus.IGNORED,
          description: 'Seeded missing provider-side transaction',
          expected_value: JSON.stringify({ reference: 'seed-missing-001' }),
          actual_value: null,
          resolution_notes: 'Ignored during fake dataset generation',
          resolved_at: new Date(),
          resolved_by: 1,
        }),
      );
    }

    await discrepancyRepo.save(discrepancies);

    console.log('Fake seed data inserted successfully.');
    console.log('');
    console.log('Suggested Admin login:');
    admins.forEach((admin, index) => {
      console.log(`  email: ${admin.email}`);
      console.log(`  password: ${SEED_ADMINS[index].password}`);
    });
    console.log('');
    console.log('Merchant API keys:');
    merchants.forEach((merchant, index) => {
      console.log(`  ${merchant.name}: ${SEED_API_KEYS[index]}`);
    });
    console.log('');
    console.log('Sandbox provider name: sandbox');
    console.log('');
    console.log(`Providers seeded: ${providers.length}`);
    console.log(`Admins seeded: ${admins.length}`);
    console.log(`Merchants seeded: ${merchants.length}`);
    console.log(`Transactions seeded: ${transactions.length}`);
    console.log(`Reconciliations seeded: ${savedReconciliations.length}`);
    console.log(`API keys seeded: ${apiKeys.length}`);
    console.log(
      `Notifications seeded: ${await notificationRepo.count({
        where: [
          { recipient_type: NotificationRecipientType.ADMIN, admin_id: In(admins.map((a) => a.id)) },
          {
            recipient_type: NotificationRecipientType.MERCHANT,
            merchant_id: In(merchants.map((m) => m.id)),
          },
        ],
      })}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

void seed().catch((error) => {
  console.error('Failed to seed fake data.');
  console.error(error);
  process.exitCode = 1;
});
