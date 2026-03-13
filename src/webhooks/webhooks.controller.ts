import { Controller, Post, Body, Headers, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { ProvidersService } from '../providers/providers.service';
import { Public } from '../common/decorators/api-key.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly providersService: ProvidersService,
  ) {}

  @Post('providers/:providerName/callback')
  @Public()
  @ApiOperation({ summary: 'Handle provider webhook callback' })
  async handleProviderWebhook(
    @Param('providerName') providerName: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    const provider = await this.providersService.findByName(providerName);
    const providerService = this.providersService.getProviderService(providerName);
    const signature =
      headers['p-signature'] ||
      headers['signature'] ||
      headers['x-signature'] ||
      '';

    // Verify webhook signature
    const secret = process.env[`${providerName.toUpperCase()}_WEBHOOK_SECRET`] || '';
    if (!providerService.verifyWebhook(payload, signature, secret)) {
      throw new Error('Invalid webhook signature');
    }

    // Handle webhook
    await this.webhooksService.handleProviderWebhook(
      provider.id,
      payload.event || 'transaction.updated',
      payload,
    );

    return { success: true };
  }
}
