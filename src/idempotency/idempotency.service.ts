import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
  ) {}

  async getResponse(
    merchantId: number,
    key: string,
  ): Promise<Transaction | null> {
    const record = await this.idempotencyRepository.findOne({
      where: { merchant_id: merchantId, key },
    });

    if (!record || !record.response_payload) {
      return null;
    }

    // Return the cached response
    return JSON.parse(record.response_payload) as Transaction;
  }

  async storeRequest(
    merchantId: number,
    key: string,
    request: any,
    response: Transaction,
  ): Promise<void> {
    const requestHash = this.hashRequest(request);

    const record = this.idempotencyRepository.create({
      merchant_id: merchantId,
      key,
      request_hash: requestHash,
      response_payload: JSON.stringify(response),
    });

    await this.idempotencyRepository.save(record);
  }

  private hashRequest(request: any): string {
    const requestString = JSON.stringify(request);
    return crypto.createHash('sha256').update(requestString).digest('hex');
  }
}
