import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ApiKey } from '../common/decorators/api-key.decorator';

@ApiTags('Merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new merchant' })
  async create(@Body() createMerchantDto: CreateMerchantDto) {
    return this.merchantsService.create(createMerchantDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all merchants' })
  async findAll() {
    return this.merchantsService.findAll();
  }

  @Get('me')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiKey()
  @ApiOperation({ summary: 'Get the authenticated merchant profile' })
  async getMe(@Request() req) {
    return req.merchant;
  }

  @Post('me/api-keys/rotate')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiKey()
  @ApiOperation({ summary: 'Rotate the authenticated merchant API key' })
  async rotateCurrentApiKey(
    @Request() req,
    @Body() body: { name?: string },
  ) {
    const headerValue = req.headers['x-api-key'];
    const currentApiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const apiKey = await this.merchantsService.rotateCurrentApiKey(
      req.merchant.id,
      currentApiKey,
      body.name,
    );
    return { api_key: apiKey };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant by ID' })
  async findOne(@Param('id') id: string) {
    return this.merchantsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update merchant by ID' })
  async update(
    @Param('id') id: string,
    @Body() updateMerchantDto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(+id, updateMerchantDto);
  }

  @Get(':id/api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List API keys for merchant' })
  async getApiKeys(@Param('id') id: string) {
    return this.merchantsService.getApiKeys(+id);
  }

  @Post(':id/api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new API key for merchant' })
  async generateApiKey(
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    const apiKey = await this.merchantsService.generateApiKey(+id, body.name);
    return { api_key: apiKey };
  }

  @Post(':id/api-keys/:keyId/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke API key' })
  async revokeApiKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    await this.merchantsService.revokeApiKey(+id, +keyId);
    return { message: 'API key revoked successfully' };
  }

  @Post(':id/provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign provider to merchant' })
  async assignProvider(
    @Param('id') id: string,
    @Body() body: { providerId: number },
  ) {
    const merchant = await this.merchantsService.assignProvider(+id, body.providerId);
    return {
      message: 'Provider assigned successfully',
      merchant: {
        id: merchant.id,
        name: merchant.name,
        provider_id: merchant.provider_id,
      },
    };
  }

  @Delete(':id/provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove provider assignment from merchant' })
  async removeProvider(@Param('id') id: string) {
    const merchant = await this.merchantsService.removeProvider(+id);
    return {
      message: 'Provider removed successfully',
      merchant: {
        id: merchant.id,
        name: merchant.name,
        provider_id: merchant.provider_id,
      },
    };
  }

  @Get(':id/provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant\'s assigned provider' })
  async getProvider(@Param('id') id: string) {
    const provider = await this.merchantsService.getAssignedProvider(+id);
    if (!provider) {
      return { message: 'No provider assigned to this merchant' };
    }
    return { provider };
  }
}
