import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Merchant, MerchantStatus } from './entities/merchant.entity';
import { MerchantBalance } from './entities/merchant-balance.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';
import { parseMoney, roundMoney } from './merchant-balance.util';
import { MerchantApiKey, ApiKeyStatus } from './entities/merchant-api-key.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
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
      relations: ['provider', 'balances'],
    });
  }

  async findOne(id: number): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({
      where: { id },
      relations: ['provider', 'balances'],
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

  async updateProfile(
    id: number,
    dto: UpdateMerchantProfileDto,
  ): Promise<Merchant> {
    const merchant = await this.findOne(id);

    if (typeof dto.name === 'string') {
      merchant.name = dto.name.trim();
    }
    if (typeof dto.email === 'string') {
      merchant.email = dto.email.trim().toLowerCase();
    }
    if (dto.phone !== undefined) {
      merchant.phone = dto.phone?.trim() || null;
    }
    if (dto.username !== undefined) {
      merchant.username = dto.username?.trim() || null;
    }
    if (dto.bio !== undefined) {
      merchant.bio = dto.bio?.trim() || null;
    }

    return this.merchantRepository.save(merchant);
  }

  async validateApiKey(apiKey: string): Promise<Merchant | null> {
    // Hash the provided API key
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await this.apiKeyRepository.findOne({
      where: { key_hash: hashedKey, status: ApiKeyStatus.ACTIVE },
      relations: ['merchant', 'merchant.balances'],
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

  private isUniqueConstraintError(err: unknown): boolean {
    const e = err as { code?: string; errno?: number };
    return (
      e?.code === 'ER_DUP_ENTRY' ||
      e?.errno === 1062 ||
      e?.code === '23505'
    );
  }

  /**
   * Returns the balance row for (merchant, currency) with a pessimistic lock, creating a zero row if needed.
   * Caller must run inside a DB transaction.
   */
  async lockMerchantBalanceRow(
    manager: EntityManager,
    merchantId: number,
    currency: string,
  ): Promise<MerchantBalance> {
    const cur = (currency || 'USD').trim().toUpperCase();

    const merchant = await manager
      .createQueryBuilder(Merchant, 'm')
      .setLock('pessimistic_write')
      .where('m.id = :id', { id: merchantId })
      .getOne();

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      let row = await manager
        .createQueryBuilder(MerchantBalance, 'b')
        .setLock('pessimistic_write')
        .where('b.merchant_id = :mid AND b.currency = :cur', {
          mid: merchantId,
          cur,
        })
        .getOne();

      if (row) {
        return row;
      }

      try {
        const created = manager.create(MerchantBalance, {
          merchant_id: merchantId,
          currency: cur,
          balance_available: '0',
          balance_locked: '0',
        });
        await manager.save(created);
      } catch (err) {
        if (!this.isUniqueConstraintError(err)) {
          throw err;
        }
      }
    }

    const row = await manager
      .createQueryBuilder(MerchantBalance, 'b')
      .setLock('pessimistic_write')
      .where('b.merchant_id = :mid AND b.currency = :cur', {
        mid: merchantId,
        cur,
      })
      .getOne();

    if (!row) {
      throw new InternalServerErrorException(
        'Failed to acquire merchant balance row',
      );
    }
    return row;
  }

  /**
   * Reserve funds for a new withdrawal (pending/processing). Caller must run inside a DB transaction.
   */
  async lockFundsForWithdrawal(
    manager: EntityManager,
    merchantId: number,
    amount: number,
    currency: string,
  ): Promise<void> {
    const cur = (currency || 'USD').trim().toUpperCase();
    const amt = roundMoney(amount);
    if (amt <= 0) {
      throw new BadRequestException('Withdrawal amount must be positive');
    }

    const balanceRow = await this.lockMerchantBalanceRow(
      manager,
      merchantId,
      cur,
    );

    const available = parseMoney(balanceRow.balance_available);
    if (available + 1e-9 < amt) {
      throw new BadRequestException('Insufficient available balance');
    }

    const locked = parseMoney(balanceRow.balance_locked);
    balanceRow.balance_available = String(roundMoney(available - amt));
    balanceRow.balance_locked = String(roundMoney(locked + amt));
    await manager.save(balanceRow);
  }

  /**
   * Apply ledger effects when a transaction status changes. Caller must run inside a DB transaction.
   */
  async applyLedgerForStatusChange(
    manager: EntityManager,
    tx: Transaction,
    previousStatus: TransactionStatus,
    newStatus: TransactionStatus,
  ): Promise<void> {
    if (previousStatus === newStatus) {
      return;
    }

    const cur = (tx.currency || 'USD').trim().toUpperCase();
    const amount = roundMoney(Number(tx.amount));

    if (tx.type === TransactionType.DEPOSIT) {
      if (
        newStatus === TransactionStatus.SUCCEEDED &&
        previousStatus !== TransactionStatus.SUCCEEDED
      ) {
        const balanceRow = await this.lockMerchantBalanceRow(
          manager,
          tx.merchant_id,
          cur,
        );
        const available = parseMoney(balanceRow.balance_available);
        balanceRow.balance_available = String(roundMoney(available + amount));
        await manager.save(balanceRow);
      } else if (
        newStatus === TransactionStatus.REVERSED &&
        previousStatus === TransactionStatus.SUCCEEDED
      ) {
        const balanceRow = await this.lockMerchantBalanceRow(
          manager,
          tx.merchant_id,
          cur,
        );
        const available = parseMoney(balanceRow.balance_available);
        if (available + 1e-9 < amount) {
          throw new InternalServerErrorException(
            'Ledger inconsistency: cannot reverse deposit — insufficient available balance',
          );
        }
        balanceRow.balance_available = String(roundMoney(available - amount));
        await manager.save(balanceRow);
      }
      return;
    }

    if (tx.type === TransactionType.WITHDRAWAL) {
      const wasInFlight =
        previousStatus === TransactionStatus.PENDING ||
        previousStatus === TransactionStatus.PROCESSING;

      if (
        (newStatus === TransactionStatus.FAILED ||
          newStatus === TransactionStatus.REVERSED) &&
        wasInFlight
      ) {
        const balanceRow = await this.lockMerchantBalanceRow(
          manager,
          tx.merchant_id,
          cur,
        );
        const locked = parseMoney(balanceRow.balance_locked);
        if (locked + 1e-9 < amount) {
          throw new InternalServerErrorException(
            'Ledger inconsistency: cannot unlock withdrawal — insufficient locked balance',
          );
        }
        const available = parseMoney(balanceRow.balance_available);
        balanceRow.balance_locked = String(roundMoney(locked - amount));
        balanceRow.balance_available = String(roundMoney(available + amount));
        await manager.save(balanceRow);
      } else if (
        newStatus === TransactionStatus.SUCCEEDED &&
        (previousStatus === TransactionStatus.PENDING ||
          previousStatus === TransactionStatus.PROCESSING)
      ) {
        const balanceRow = await this.lockMerchantBalanceRow(
          manager,
          tx.merchant_id,
          cur,
        );
        const locked = parseMoney(balanceRow.balance_locked);
        if (locked + 1e-9 < amount) {
          throw new InternalServerErrorException(
            'Ledger inconsistency: cannot settle withdrawal — insufficient locked balance',
          );
        }
        balanceRow.balance_locked = String(roundMoney(locked - amount));
        await manager.save(balanceRow);
      }
      return;
    }
  }
}
