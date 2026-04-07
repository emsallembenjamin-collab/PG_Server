import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VietnamBankCode } from './entities/vietnam-bank-code.entity';

@Injectable()
export class BanksService {
  constructor(
    @InjectRepository(VietnamBankCode)
    private readonly vietnamBankRepo: Repository<VietnamBankCode>,
  ) {}

  findAllVietnamCodes(): Promise<VietnamBankCode[]> {
    return this.vietnamBankRepo.find({
      order: { code: 'ASC' },
    });
  }
}
