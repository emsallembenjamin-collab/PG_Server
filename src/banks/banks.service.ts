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

  /**
   * Maps withdrawal metadata to a Vietnam Napas/BIN-style bank code for DPay `bank_name`.
   * Tries, in order: `vietnam_bank_code`, `vietnam_bank_bin`, `bank_code`, `bank_name`.
   * - Exact match on `vietnam_bank_codes.code` (e.g. 970416)
   * - Case-insensitive match on `abbreviation` (e.g. VCB → 970436)
   * Returns null if no row matches (caller should pass through raw `bank_name` / DPay channel code).
   */
  async resolveVietnamBinForDpayPayout(
    metadata: Record<string, unknown>,
  ): Promise<string | null> {
    const keys = [
      'vietnam_bank_code',
      'vietnam_bank_bin',
      'bank_code',
      'bank_name',
    ] as const;

    for (const key of keys) {
      const v = metadata[key];
      if (v === undefined || v === null) continue;
      const s = String(v).trim();
      if (!s) continue;
      const bin = await this.findVietnamBinByCodeOrAbbreviation(s);
      if (bin) return bin;
    }
    return null;
  }

  private async findVietnamBinByCodeOrAbbreviation(s: string): Promise<string | null> {
    const trimmed = s.trim();
    if (!trimmed) return null;

    const byCode = await this.vietnamBankRepo.findOne({
      where: { code: trimmed },
    });
    if (byCode) return byCode.code;

    const byAbbrev = await this.vietnamBankRepo
      .createQueryBuilder('b')
      .where('UPPER(TRIM(b.abbreviation)) = UPPER(TRIM(:a))', { a: trimmed })
      .getOne();
    if (byAbbrev) return byAbbrev.code;

    return null;
  }
}
