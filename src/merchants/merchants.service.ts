import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Merchant, MerchantStatus } from './entities/merchant.entity';
import { MerchantApiKey, ApiKeyStatus } from './entities/merchant-api-key.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ProviderStatus } from '../providers/entities/provider.entity';
import { ProvidersService } from '../providers/providers.service';
import { normalizeIpList } from '../common/utils/ip.utils';

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantApiKey)
    private apiKeyRepository: Repository<MerchantApiKey>,
    private providersService: ProvidersService,
  ) {}

  async create(createMerchantDto: CreateMerchantDto): Promise<Merchant> {
    const merchant = this.merchantRepository.create({
      ...createMerchantDto,
      name: createMerchantDto.name.trim(),
      email: createMerchantDto.email.trim().toLowerCase(),
      webhook_url: createMerchantDto.webhook_url?.trim() || null,
      whitelisted_ips: normalizeIpList(createMerchantDto.whitelisted_ips),
    });

    return this.merchantRepository.save(merchant);
  }

  async findAll(): Promise<Merchant[]> {
    return this.merchantRepository.find({
      relations: ['provider'],
    });
  }

  async findOne(id: number): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
      relations: ['provider'],
    });
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${id} not found`);
    }
    return merchant;
  }

  async update(id: number, updateMerchantDto: UpdateMerchantDto): Promise<Merchant> {
    const merchant = await this.findOne(id);

    if (typeof updateMerchantDto.name === 'string') {
      merchant.name = updateMerchantDto.name.trim();
    }

    if (typeof updateMerchantDto.email === 'string') {
      merchant.email = updateMerchantDto.email.trim().toLowerCase();
    }

    if (updateMerchantDto.status) {
      merchant.status = updateMerchantDto.status;
    }

    if (updateMerchantDto.webhook_url !== undefined) {
      merchant.webhook_url = updateMerchantDto.webhook_url?.trim() || null;
    }

    if (updateMerchantDto.whitelisted_ips !== undefined) {
      merchant.whitelisted_ips = normalizeIpList(updateMerchantDto.whitelisted_ips);
    }

    return this.merchantRepository.save(merchant);
  }

  async validateApiKey(apiKey: string): Promise<Merchant | null> {
    // Hash the provided API key
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await this.apiKeyRepository.findOne({
      where: { key_hash: hashedKey, status: ApiKeyStatus.ACTIVE },
      relations: ['merchant'],
    });

    if (!apiKeyRecord || apiKeyRecord.merchant.status !== MerchantStatus.ACTIVE) {
      return null;
    }

    return apiKeyRecord.merchant;
  }

  async generateApiKey(merchantId: number, name?: string): Promise<string> {
    await this.findOne(merchantId);
    const apiKey = await this.issueApiKey(merchantId, name || 'Default API Key');

    // Return the plain API key (only shown once)
    return apiKey;
  }

  async rotateCurrentApiKey(
    merchantId: number,
    currentApiKey: string,
    name?: string,
  ): Promise<string> {
    await this.findOne(merchantId);

    const currentKeyHash = crypto.createHash('sha256').update(currentApiKey).digest('hex');
    const currentKeyRecord = await this.apiKeyRepository.findOne({
      where: {
        merchant_id: merchantId,
        key_hash: currentKeyHash,
        status: ApiKeyStatus.ACTIVE,
      },
    });

    if (!currentKeyRecord) {
      throw new NotFoundException('Current API key not found');
    }

    const nextKey = await this.issueApiKey(
      merchantId,
      name?.trim() || currentKeyRecord.name || 'Rotated API Key',
    );

    currentKeyRecord.status = ApiKeyStatus.REVOKED;
    await this.apiKeyRepository.save(currentKeyRecord);

    return nextKey;
  }

  async getApiKeys(merchantId: number) {
    await this.findOne(merchantId);
    const keys = await this.apiKeyRepository.find({
      where: { merchant_id: merchantId },
      order: { created_at: 'DESC' },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      status: k.status,
      key_prefix: 'gpk_••••••••',
      created_at: k.created_at,
    }));
  }

  async revokeApiKey(merchantId: number, apiKeyId: number): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: apiKeyId, merchant_id: merchantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    await this.apiKeyRepository.save(apiKey);
  }

  private async issueApiKey(merchantId: number, name: string): Promise<string> {
    const apiKey = `gpk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = this.apiKeyRepository.create({
      merchant_id: merchantId,
      key_hash: keyHash,
      name,
      status: ApiKeyStatus.ACTIVE,
    });

    await this.apiKeyRepository.save(apiKeyRecord);
    return apiKey;
  }

  /**
   * Assign a provider to a merchant
   * Only one provider can be assigned per merchant
   */
  async assignProvider(merchantId: number, providerId: number): Promise<Merchant> {
    const merchant = await this.findOne(merchantId);

    // Verify provider exists and is active
    const provider = await this.providersService.findOne(providerId);
    if (provider.status !== ProviderStatus.ACTIVE) {
      throw new BadRequestException('Provider is not active');
    }

    merchant.provider_id = providerId;
    return this.merchantRepository.save(merchant);
  }

  /**
   * Remove provider assignment from merchant
   */
  async removeProvider(merchantId: number): Promise<Merchant> {
    const merchant = await this.findOne(merchantId);
    merchant.provider_id = null;
    return this.merchantRepository.save(merchant);
  }

  /**
   * Get merchant's assigned provider
   */
  async getAssignedProvider(merchantId: number) {
    const merchant = await this.findOne(merchantId);
    if (!merchant.provider_id) {
      return null;
    }
    return merchant.provider;
  }
}
