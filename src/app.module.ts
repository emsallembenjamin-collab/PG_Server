import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

// Core Modules
import { MerchantsModule } from './merchants/merchants.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ProvidersModule } from './providers/providers.module';
import { AuthModule } from './auth/auth.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MerchantUiModule } from './merchant-ui/merchant-ui.module';
import { BanksModule } from './banks/banks.module';
import { SystemFeeModule } from './system-fee/system-fee.module';

// Common
import { CommonModule } from './common/common.module';
import { ensureMerchantBalanceIndexesBeforeSync } from './database/ensure-merchant-balance-indexes';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('DB_HOST', 'localhost');
        const port = configService.get<number>('DB_PORT', 3306);
        const username = configService.get<string>('DB_USERNAME');
        const password = configService.get<string>('DB_PASSWORD');
        const database = configService.get<string>('DB_DATABASE');

        await ensureMerchantBalanceIndexesBeforeSync({
          host,
          port,
          username: username ?? '',
          password: password ?? '',
          database: database ?? '',
        });

        return {
          type: 'mysql' as const,
          host,
          port,
          username,
          password,
          database,
          autoLoadEntities: true,
          synchronize: configService.get<string>('NODE_ENV') === 'development',
          logging: configService.get<string>('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
      inject: [ConfigService],
    }),

    // Queue System
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),

    // Scheduled Tasks
    ScheduleModule.forRoot(),

    // Application Modules
    CommonModule,
    AuthModule,
    CurrenciesModule,
    MerchantsModule,
    TransactionsModule,
    WebhooksModule,
    ProvidersModule,
    IdempotencyModule,
    ReconciliationModule,
    NotificationsModule,
    MerchantUiModule,
    BanksModule,
    SystemFeeModule,
  ],
})
export class AppModule {}
