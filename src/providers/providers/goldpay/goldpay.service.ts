import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { IProviderService, ProcessTransactionRequest, ProcessTransactionResponse } from '../../interfaces/provider.interface';

@Injectable()
export class GoldPayService implements IProviderService {
  private apiKey: string;
  private privateKey: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOLDPAY_API_KEY') || '';
    this.privateKey = this.configService.get<string>('GOLDPAY_PRIVATE_KEY') || '';
    this.baseUrl = this.configService.get<string>('GOLDPAY_BASE_URL') || 'https://goldpay.app/goldpayy/public/api';
  }

  async processTransaction(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    try {
      const endpoint = request.type === 'deposit' ? '/bank/in' : '/bank/out';
      const callbackUrl = `${this.configService.get<string>('FRONTEND_URL')}/api/v1/webhooks/providers/goldpay/callback`;

      const payload = {
        type: 'bank',
        ref_id: `tx_${request.transactionId}`,
        callback: callbackUrl,
        bank_type: 'VTB',
        amount: request.amount,
      };

      const checksum = this.generateChecksum(payload);

      const response = await axios.post(
        `${this.baseUrl}${endpoint}`,
        payload,
        {
          headers: {
            APIKEY: this.apiKey,
            Checksum: checksum,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.err_code) {
        return {
          success: false,
          error: response.data.err_msg || 'GoldPay API error',
        };
      }

      const payUrl = response.data.pay_url;
      return {
        success: true,
        externalId: response.data.ref_id,
        paymentUrl: payUrl,
        paymentDetails: payUrl ? { url: payUrl } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'GoldPay service error',
      };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const calculatedChecksum = this.generateChecksum(payload);
    return calculatedChecksum === signature;
  }

  normalizeStatus(providerStatus: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'processing': 'processing',
      'completed': 'succeeded',
      'failed': 'failed',
      'cancelled': 'failed',
    };

    return statusMap[providerStatus.toLowerCase()] || 'pending';
  }

  private generateChecksum(payload: Record<string, any>): string {
    // Sort keys
    const sortedKeys = Object.keys(payload).sort();
    const sortedPayload: Record<string, any> = {};
    for (const key of sortedKeys) {
      sortedPayload[key] = payload[key];
    }

    // Create JSON string
    let requestBody = JSON.stringify(sortedPayload);
    requestBody = requestBody.replace(/,\s*/g, ',').replace(/:\s*/g, ':');
    requestBody = requestBody.replace(/\//g, '\\/');

    // Generate HMAC-MD5
    const hmac = crypto.createHmac('md5', this.privateKey);
    hmac.update(requestBody, 'utf8');
    return hmac.digest('hex');
  }
}
