import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import {
  IProviderService,
  ProcessTransactionRequest,
  ProcessTransactionResponse,
} from '../../interfaces/provider.interface';

type DpaySignMode = 'values_only' | 'key_value' | 'json';
type DpaySignSecretPosition = 'append' | 'prepend';
type DpaySignAlgorithm = 'md5' | 'sha1' | 'sha256';

@Injectable()
export class DpayService implements IProviderService {
  private readonly baseUrl: string;
  private readonly uid: string;
  private readonly merchantNum: string;
  private readonly secret: string;
  private readonly callbackBaseUrl: string;
  private readonly defaultPayType: string;
  private readonly defaultUserIp: string;
  private readonly signMode: DpaySignMode;
  private readonly signSecretPosition: DpaySignSecretPosition;
  private readonly signAlgorithm: DpaySignAlgorithm;
  private readonly signOutputCase: 'lower' | 'upper';
  private readonly signFields: string[];

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('DPAY_BASE_URL') || 'https://pay.dpayvn.com'
    ).replace(/\/+$/, '');
    this.uid = this.configService.get<string>('DPAY_UID') || '';
    this.merchantNum = this.configService.get<string>('DPAY_MERCHANT_NUM') || '';
    this.secret =
      this.configService.get<string>('DPAY_SECRET') ||
      this.configService.get<string>('DPAY_API_SECRET') ||
      '';
    this.callbackBaseUrl = (
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      ''
    ).replace(/\/+$/, '');
    this.defaultPayType = this.configService.get<string>('DPAY_DEFAULT_PAY_TYPE') || '7';
    this.defaultUserIp = this.configService.get<string>('DPAY_DEFAULT_USER_IP') || '127.0.0.1';
    this.signMode = this.parseSignMode(
      this.configService.get<string>('DPAY_SIGN_MODE') || 'key_value',
    );
    this.signSecretPosition = this.parseSignSecretPosition(
      this.configService.get<string>('DPAY_SIGN_SECRET_POSITION') || 'append',
    );
    this.signAlgorithm = this.parseSignAlgorithm(
      this.configService.get<string>('DPAY_SIGN_ALGORITHM') || 'md5',
    );
    this.signOutputCase =
      (this.configService.get<string>('DPAY_SIGN_OUTPUT_CASE') || 'upper').toLowerCase() ===
      'upper'
        ? 'upper'
        : 'lower';
    this.signFields = (this.configService.get<string>('DPAY_SIGN_FIELDS') || '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
  }

  async processTransaction(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    try {
      return request.type === 'deposit'
        ? await this.createDeposit(request)
        : await this.createWithdrawal(request);
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.response?.data?.msg ||
          error?.message ||
          'DPay service error',
      };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const incomingSignature = String(signature || payload?.sign || '').trim();
    const signingSecret = String(secret || this.secret || '').trim();
    if (!incomingSignature || !signingSecret) {
      return false;
    }

    const expectedSignature = this.generateSignature(payload, signingSecret);
    return this.safeEqual(expectedSignature, incomingSignature);
  }

  normalizeStatus(providerStatus: string): string {
    const normalized = String(providerStatus || '').trim().toLowerCase();

    const statusMap: Record<string, string> = {
      '1': 'succeeded',
      success: 'succeeded',
      succeeded: 'succeeded',
      successful: 'succeeded',
      '2': 'processing',
      pending: 'processing',
      processing: 'processing',
      '3': 'processing',
      rejected: 'failed',
      reject: 'failed',
      failed: 'failed',
      failure: 'failed',
      error: 'failed',
      '0': 'failed',
    };

    return statusMap[normalized] || 'processing';
  }

  private async createDeposit(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    const metadata = request.metadata || {};
    const endpoint = this.resolveDepositEndpoint(metadata);
    const merchantOrder = this.resolveOrderValue(
      metadata.merchant_order || metadata.order || metadata.m_order,
      request.transactionId,
    );

    const payload: Record<string, string> = {
      uid: this.resolveConfigValue(metadata.uid, this.uid),
      merchant_num: this.resolveConfigValue(metadata.merchant_num, this.merchantNum),
      merchant_order: merchantOrder,
      coin: this.normalizeAmount(request.amount),
      pay_notifyurl: String(
        metadata.pay_notifyurl || metadata.notifyurl || this.buildCallbackUrl('dpay'),
      ),
      pay_callbackurl: String(
        metadata.pay_callbackurl || metadata.redirect_url || metadata.redirectUrl || '',
      ),
      pay_date: this.formatDate(metadata.pay_date),
      extend: String(metadata.extend || ''),
      pay_type: String(metadata.pay_type || this.defaultPayType),
      userinfo: String(metadata.userinfo || metadata.member_id || merchantOrder),
      user_ip: String(metadata.user_ip || metadata.ip || this.defaultUserIp),
    };

    if (metadata.bank_code !== undefined && metadata.bank_code !== null && metadata.bank_code !== '') {
      payload.bank_code = String(metadata.bank_code);
    }

    this.ensureRequiredFields(payload, [
      'uid',
      'merchant_num',
      'merchant_order',
      'coin',
      'pay_date',
      'extend',
      'pay_type',
      'userinfo',
      'user_ip',
    ]);

    payload.sign = this.generateSignature(payload);

    const response = await this.postForm(endpoint, payload);
    const data = response.data || {};
    if (!this.isSuccessCode(data.code)) {
      return {
        success: false,
        error: data.message || data.msg || `DPay deposit failed with code ${data.code}`,
      };
    }

    const payInfo = data.pay_info || {};
    return {
      success: true,
      externalId: String(
        payInfo.order || payInfo.m_order || data.serial_number || merchantOrder,
      ),
      paymentUrl: data.payurl || undefined,
      status: 'processing',
    };
  }

  private async createWithdrawal(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    const metadata = request.metadata || {};
    const order = this.resolveOrderValue(
      metadata.order || metadata.merchant_order || metadata.m_order,
      request.transactionId,
    );

    const payload: Record<string, string> = {
      uid: this.resolveConfigValue(metadata.uid, this.uid),
      merchant_num: this.resolveConfigValue(metadata.merchant_num, this.merchantNum),
      order,
      coin: this.normalizeAmount(request.amount),
      userinfo: String(metadata.userinfo || metadata.member_id || order),
      target_bank: String(metadata.target_bank || metadata.target_bank_number || ''),
      bank_name: String(metadata.bank_name || metadata.bank_code || ''),
      target_bank_user: String(metadata.target_bank_user || metadata.bank_user || ''),
      extend: String(metadata.extend || ''),
      order_date: this.formatDate(metadata.order_date),
      notifyurl: String(
        metadata.notifyurl || metadata.pay_notifyurl || this.buildCallbackUrl('dpay'),
      ),
      user_ip: String(metadata.user_ip || metadata.ip || this.defaultUserIp),
    };

    this.ensureRequiredFields(payload, [
      'uid',
      'merchant_num',
      'order',
      'coin',
      'userinfo',
      'target_bank',
      'bank_name',
      'target_bank_user',
      'extend',
      'order_date',
      'user_ip',
    ]);

    payload.sign = this.generateSignature(payload);

    const response = await this.postForm('/payment', payload);
    const data = response.data || {};
    if (!this.isSuccessCode(data.code)) {
      return {
        success: false,
        error: data.message || data.msg || `DPay withdrawal failed with code ${data.code}`,
      };
    }

    return {
      success: true,
      externalId: order,
      status: 'processing',
    };
  }

  private async postForm(path: string, payload: Record<string, string>) {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      body.append(key, value ?? '');
    }

    return axios.post(`${this.baseUrl}${path}`, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });
  }

  private generateSignature(payload: Record<string, any>, secret?: string): string {
    const signingSecret = String(secret || this.secret || '').trim();
    if (!signingSecret) {
      throw new Error('DPAY_SECRET is required');
    }

    const keys = this.getKeysForSignature(payload);
    const message = this.buildSignMessage(payload, keys);
    const raw =
      this.signSecretPosition === 'prepend'
        ? `${signingSecret}${message}`
        : `${message}${signingSecret}`;

    let digest = crypto.createHash(this.signAlgorithm).update(raw, 'utf8').digest('hex');
    if (this.signOutputCase === 'upper') {
      digest = digest.toUpperCase();
    }

    return digest;
  }

  private getKeysForSignature(payload: Record<string, any>): string[] {
    if (this.signFields.length > 0) {
      return this.signFields.filter(
        (key) =>
          key !== 'sign' &&
          key in payload &&
          this.shouldIncludeInSignature(payload[key]),
      );
    }

    return Object.keys(payload)
      .filter((key) => key !== 'sign' && this.shouldIncludeInSignature(payload[key]))
      .sort();
  }

  private buildSignMessage(payload: Record<string, any>, keys: string[]): string {
    if (this.signMode === 'json') {
      const objectToSign: Record<string, string> = {};
      for (const key of keys) {
        objectToSign[key] = String(payload[key] ?? '');
      }
      return JSON.stringify(objectToSign);
    }

    if (this.signMode === 'key_value') {
      return keys.map((key) => `${key}=${String(payload[key] ?? '')}`).join('&');
    }

    return keys.map((key) => String(payload[key] ?? '')).join('');
  }

  private shouldIncludeInSignature(value: any): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalizedValue = String(value);
    if (normalizedValue.trim() === '') {
      return false;
    }

    return normalizedValue !== '0';
  }

  private resolveDepositEndpoint(metadata: Record<string, any>): string {
    const mode = String(metadata.deposit_mode || metadata.mode || 'json')
      .trim()
      .toLowerCase();

    if (mode === 'redirect') {
      return '/Index';
    }

    if (mode === 'cust' || mode === 'custom') {
      return '/index/deposit_cust';
    }

    return '/index/deposit_json';
  }

  private buildCallbackUrl(providerName: string): string {
    if (!this.callbackBaseUrl) {
      return '';
    }
    return `${this.callbackBaseUrl}/api/v1/webhooks/providers/${providerName}/callback`;
  }

  private resolveConfigValue(primary: any, fallback: string): string {
    return String(primary ?? fallback ?? '').trim();
  }

  private resolveOrderValue(value: any, transactionId: number): string {
    const resolved = String(value || '').trim();
    return resolved || `tx_${transactionId}`;
  }

  private normalizeAmount(amount: number): string {
    return Math.round(Number(amount)).toString();
  }

  private formatDate(value?: string): string {
    if (value) {
      return String(value);
    }

    const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  private isSuccessCode(code: any): boolean {
    return String(code ?? '').trim() === '1';
  }

  private ensureRequiredFields(payload: Record<string, string>, requiredKeys: string[]) {
    for (const key of requiredKeys) {
      if (payload[key] === undefined || payload[key] === null || String(payload[key]).trim() === '') {
        throw new Error(`DPay field ${key} is required`);
      }
    }
  }

  private parseSignMode(value: string): DpaySignMode {
    const normalized = value.toLowerCase();
    if (normalized === 'key_value' || normalized === 'json') {
      return normalized;
    }
    return 'values_only';
  }

  private parseSignSecretPosition(value: string): DpaySignSecretPosition {
    return value.toLowerCase() === 'prepend' ? 'prepend' : 'append';
  }

  private parseSignAlgorithm(value: string): DpaySignAlgorithm {
    const normalized = value.toLowerCase();
    if (normalized === 'sha1' || normalized === 'sha256') {
      return normalized;
    }
    return 'md5';
  }

  private safeEqual(leftValue: string, rightValue: string): boolean {
    const left = Buffer.from(leftValue, 'utf8');
    const right = Buffer.from(rightValue, 'utf8');
    if (left.length !== right.length) {
      return false;
    }
    return crypto.timingSafeEqual(left, right);
  }
}
