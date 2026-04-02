import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import {
  filterOpenApiByTag,
  MERCHANT_INTEGRATION_TAG,
} from './docs/swagger-merchant.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  const trustProxy = parseTrustProxy(configService.get<string>('TRUST_PROXY'));

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Allow merchants to submit HTML forms (`application/x-www-form-urlencoded`).
  app.use(express.urlencoded({ extended: true }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger — full platform (admin + merchants + webhooks)
  const config = new DocumentBuilder()
    .setTitle('GoldPay Platform API')
    .setDescription(
      `Internal and operator API (JWT), merchant integration (API key), and webhooks.\n\n` +
        `**Merchants:** use the dedicated Merchant API UI at \`/api/docs/merchant\` (API key only) or read \`docs/MERCHANT_API.md\`.`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Merchant-only OpenAPI (tag-filtered; shareable with integrators)
  const merchantConfig = new DocumentBuilder()
    .setTitle('GoldPay Merchant API')
    .setDescription(
      `REST API for merchants integrating deposits, withdrawals, and webhooks with GoldPay.\n\n` +
        `**Auth:** \`X-API-Key\` (secret issued by the platform admin).\n\n` +
        `**Provider:** Each merchant is assigned one payment provider by the platform; you do not call provider APIs directly.\n\n` +
        `**PDF / offline:** See \`docs/MERCHANT_API.md\` in the repository.\n\n` +
        `**DPay error codes:** See \`docs/DPAY_ERROR_CODES.md\` when the assigned provider is DPay.\n\n` +
        `**DPay payout inquiry:** \`POST /funding/payout-inquiry\` — see \`docs/DPAY_PAYOUT_INQUIRY.md\`.`,
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();
  const merchantDocument = filterOpenApiByTag(
    SwaggerModule.createDocument(app, merchantConfig),
    MERCHANT_INTEGRATION_TAG,
  );
  SwaggerModule.setup('api/docs/merchant', app, merchantDocument, {
    customSiteTitle: 'GoldPay Merchant API',
  });

  await app.listen(port);
  console.log(`🚀 GoldPay Platform API is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Swagger (full): http://localhost:${port}/api/docs`);
  console.log(`📗 Swagger (merchants): http://localhost:${port}/api/docs/merchant`);
}

function parseTrustProxy(value?: string): boolean | number | string | string[] | undefined {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return undefined;
  }

  const lowerCasedValue = normalizedValue.toLowerCase();
  if (['false', 'off', 'no'].includes(lowerCasedValue)) {
    return false;
  }

  if (['true', 'on', 'yes'].includes(lowerCasedValue)) {
    return true;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  const entries = normalizedValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return undefined;
  }

  return entries.length === 1 ? entries[0] : entries;
}

bootstrap();
