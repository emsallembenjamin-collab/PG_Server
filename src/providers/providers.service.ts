import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider, ProviderStatus } from './entities/provider.entity';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { GoldPayService } from './providers/goldpay/goldpay.service';
import { PaymentHotService } from './providers/paymenthot/paymenthot.service';
import { SandboxService } from './providers/sandbox/sandbox.service';
import { IProviderService } from './interfaces/provider.interface';

@Injectable()
export class ProvidersService {
  private providerServices: Map<string, IProviderService> = new Map();

  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    private goldPayService: GoldPayService,
    private paymentHotService: PaymentHotService,
    private sandboxService: SandboxService,
  ) {
    // Register provider services
    this.providerServices.set('goldpay', this.goldPayService);
    this.providerServices.set('paymenthot', this.paymentHotService);
    this.providerServices.set('sandbox', this.sandboxService);
  }

  async findAll(): Promise<Provider[]> {
    return this.providerRepository.find({
      order: { priority: 'ASC' },
    });
  }

  async findActive(): Promise<Provider[]> {
    return this.providerRepository.find({
      where: { status: ProviderStatus.ACTIVE },
      order: { priority: 'ASC' },
    });
  }

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    const provider = this.providerRepository.create({
      ...createProviderDto,
      name: createProviderDto.name.trim(),
      display_name: createProviderDto.display_name.trim(),
      config: createProviderDto.config?.trim() || null,
      fee_percentage: createProviderDto.fee_percentage ?? null,
      min_amount: createProviderDto.min_amount ?? null,
      max_amount: createProviderDto.max_amount ?? null,
    });

    return this.providerRepository.save(provider);
  }

  async findOne(id: number): Promise<Provider> {
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return provider;
  }

  async update(id: number, updateProviderDto: UpdateProviderDto): Promise<Provider> {
    const provider = await this.findOne(id);

    if (typeof updateProviderDto.name === 'string') {
      provider.name = updateProviderDto.name.trim();
    }
    if (typeof updateProviderDto.display_name === 'string') {
      provider.display_name = updateProviderDto.display_name.trim();
    }
    if (updateProviderDto.status) {
      provider.status = updateProviderDto.status;
    }
    if (updateProviderDto.priority !== undefined) {
      provider.priority = updateProviderDto.priority;
    }
    if (updateProviderDto.fee_percentage !== undefined) {
      provider.fee_percentage = updateProviderDto.fee_percentage;
    }
    if (updateProviderDto.min_amount !== undefined) {
      provider.min_amount = updateProviderDto.min_amount;
    }
    if (updateProviderDto.max_amount !== undefined) {
      provider.max_amount = updateProviderDto.max_amount;
    }
    if (updateProviderDto.config !== undefined) {
      provider.config = updateProviderDto.config?.trim() || null;
    }

    return this.providerRepository.save(provider);
  }

  async findByName(name: string): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { name },
    });
    if (!provider) {
      throw new NotFoundException(`Provider ${name} not found`);
    }
    return provider;
  }

  getProviderService(name: string): IProviderService {
    const service = this.providerServices.get(name.toLowerCase());
    if (!service) {
      throw new NotFoundException(`Provider service ${name} not found`);
    }
    return service;
  }

  async selectProvider(
    type: 'deposit' | 'withdrawal',
    amount: number,
  ): Promise<Provider | null> {
    const providers = await this.providerRepository
      .createQueryBuilder('provider')
      .where('provider.status = :status', { status: 'active' })
      .andWhere(
        '(provider.min_amount IS NULL OR provider.min_amount <= :amount)',
        { amount },
      )
      .andWhere(
        '(provider.max_amount IS NULL OR provider.max_amount >= :amount)',
        { amount },
      )
      .orderBy('provider.priority', 'ASC')
      .getMany();

    // Return first available provider (can add more complex routing logic)
    return providers.length > 0 ? providers[0] : null;
  }
}
