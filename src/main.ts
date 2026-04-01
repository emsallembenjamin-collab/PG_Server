import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

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

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('GoldPay Platform API')
    .setDescription('Multi-provider payment platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`🚀 GoldPay Platform API is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
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
