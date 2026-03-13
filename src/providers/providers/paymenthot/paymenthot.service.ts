import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { IProviderService, ProcessTransactionRequest, ProcessTransactionResponse } from '../../interfaces/provider.interface';

@Injectable()
export class PaymentHotService implements IProviderService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private checkoutBaseUrl: string;
  private tenant: string;
  private username: string;
  private password: string;
  private passcode: string;
  private privateKey: string;
  private merchantId: string;
  private merchantKey: string;
  private defaultCurrency: string;
  private defaultLanguage: string;
  private redirectUrl: string;
  private payoutApiPath: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PAYMENTHOT_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('PAYMENTHOT_API_SECRET') || '';
    this.baseUrl = this.configService.get<string>('PAYMENTHOT_BASE_URL') || 'https://uat-api.paymenthot.com';
    this.checkoutBaseUrl = this.configService.get<string>('PAYMENTHOT_CHECKOUT_BASE_URL') || 'https://uat-checkout.paymenthot.com';
    this.tenant = this.configService.get<string>('PAYMENTHOT_TENANT') || 'MERCHANT-WEB';
    this.username = this.configService.get<string>('PAYMENTHOT_USERNAME') || '';
    this.password = this.configService.get<string>('PAYMENTHOT_PASSWORD') || '';
    this.passcode = this.configService.get<string>('PAYMENTHOT_PASSCODE') || this.password;
    this.privateKey = (this.configService.get<string>('PAYMENTHOT_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
    this.merchantId = this.configService.get<string>('PAYMENTHOT_MERCHANT_ID') || '';
    this.merchantKey = this.configService.get<string>('PAYMENTHOT_MERCHANT_KEY') || '';
    this.defaultCurrency = (this.configService.get<string>('PAYMENTHOT_DEFAULT_CURRENCY') || 'VND').toUpperCase();
    this.defaultLanguage = this.configService.get<string>('PAYMENTHOT_DEFAULT_LANGUAGE') || 'vi';
    this.redirectUrl = this.configService.get<string>('PAYMENTHOT_REDIRECT_URL') || '';
    this.payoutApiPath = '/merchant-transaction-service/api/v2.0/transfer_247';
  }

  async processTransaction(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    try {
      if (request.type === 'deposit') {
        return this.createRedirectCollection(request);
      }

      const payoutResult = await this.createPayoutTransfer(request);
      if (!payoutResult.success) {
        return {
          success: false,
          error: payoutResult.error || 'PaymentHot payout error',
        };
      }

      return {
        success: true,
        externalId: payoutResult.externalId,
        paymentUrl: payoutResult.paymentUrl,
        status: payoutResult.status || 'processing',
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'PaymentHot service error',
      };
    }
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    const signatureInput = signature || payload?.signature || payload?.['p-signature'] || '';
    const signingSecret = secret || this.apiSecret;
    if (!signatureInput || !signingSecret) {
      return false;
    }

    const calculatedSignature = this.generateWebhookSignature(payload, signingSecret);
    return this.safeEqual(calculatedSignature, decodeURIComponent(signatureInput));
  }

  normalizeStatus(providerStatus: string): string {
    if (!providerStatus) {
      return 'pending';
    }

    const statusMap: Record<string, string> = {
      'init': 'pending',
      'processing': 'processing',
      'success': 'succeeded',
      'succeeded': 'succeeded',
      'fail': 'failed',
      'failed': 'failed',
      'cancel': 'failed',
      'cancelled': 'failed',
      'reversed': 'failed',
    };

    return statusMap[providerStatus.toLowerCase()] || 'pending';
  }

  private async createRedirectCollection(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    const metadata = request.metadata || {};
    const orderCode = String(metadata.order_code || metadata.orderCode || `tx_${request.transactionId}`);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      merchant_id: metadata.merchant_id || metadata.merchantId || this.merchantId,
      order_code: orderCode,
      total_amount: this.normalizeAmount(request.amount),
      currency: (request.currency || this.defaultCurrency).toUpperCase(),
      language: String(metadata.language || this.defaultLanguage),
      timestamp,
      content: String(metadata.content || `Payment for ${orderCode}`),
    };

    const urlRedirect = String(metadata.url_redirect || metadata.urlRedirect || this.redirectUrl || '').trim();
    if (urlRedirect) {
      params.url_redirect = urlRedirect;
    }

    if (!params.merchant_id) {
      return { success: false, error: 'PAYMENTHOT_MERCHANT_ID is required for redirect collection' };
    }
    if (!this.merchantKey) {
      return { success: false, error: 'PAYMENTHOT_MERCHANT_KEY is required for redirect collection' };
    }

    const signature = this.generateRedirectSignature(params);
    const queryParams = new URLSearchParams({ ...params, signature });
    const baseUrl = this.checkoutBaseUrl.replace(/\/+$/, '');

    return {
      success: true,
      externalId: orderCode,
      paymentUrl: `${baseUrl}/?${queryParams.toString()}`,
      status: 'processing',
    };
  }

  private async createPayoutTransfer(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    if (!this.username || !this.password || !this.privateKey) {
      return {
        success: false,
        error: 'PaymentHot payout credentials are missing: PAYMENTHOT_USERNAME, PAYMENTHOT_PASSWORD, PAYMENTHOT_PRIVATE_KEY',
      };
    }

    const metadata = request.metadata || {};
    const bankId = String(metadata.bankId || metadata.bank_id || '');
    const bankCode = String(metadata.bankCode || metadata.bank_code || '');
    const bankRefNumber = String(metadata.bankRefNumber || metadata.bank_ref_number || '');
    const bankRefName = String(metadata.bankRefName || metadata.bank_ref_name || '');
    const content = String(metadata.content || `Withdrawal tx_${request.transactionId}`);

    if (!bankId || !bankCode || !bankRefNumber || !bankRefName) {
      return {
        success: false,
        error: 'Withdrawal metadata requires bankId, bankCode, bankRefNumber, and bankRefName',
      };
    }

    const accessToken = await this.login();
    const verification =
      String(metadata.verification || '') || (await this.imploreTransfer(accessToken));

    const auditValue = metadata.audit || metadata.auditNumber || this.generateAuditNumber();
    const audit = Number(auditValue);

    const body = {
      audit,
      amount: Number(request.amount),
      bankId,
      bankRefNumber,
      bankRefName,
      bankCode,
      content,
    };

    const response = await this.requestWithSignature({
      method: 'POST',
      path: this.payoutApiPath,
      body,
      accessToken,
      verification,
    });

    if (response.data?.code !== 'SUCCESS') {
      return {
        success: false,
        error: response.data?.message || response.data?.code || 'PaymentHot payout transfer failed',
      };
    }

    const traceNumber = response.data?.data?.traceNumber;
    return {
      success: true,
      externalId: traceNumber ? String(traceNumber) : String(audit),
      status: 'processing',
    };
  }

  private async login(): Promise<string> {
    const body = {
      username: this.username,
      password: this.sha256HexBase64(`${this.username}${this.password}`),
    };

    const response = await this.requestWithSignature({
      method: 'POST',
      path: '/auth-service/api/v1.0/user/login',
      body,
      accessToken: undefined,
    });

    if (response.data?.code !== 'SUCCESS' || !response.data?.data?.accessToken) {
      throw new Error(response.data?.message || 'PaymentHot login failed');
    }

    return response.data.data.accessToken;
  }

  private async imploreTransfer(accessToken: string): Promise<string> {
    const body = {
      phone: this.username,
      api: this.payoutApiPath,
      authMode: 'PASSCODE',
      authValue: this.sha256HexBase64(`${this.username}${this.passcode}`),
    };

    const response = await this.requestWithSignature({
      method: 'POST',
      path: '/auth-service/api/v1.0/implore-auth',
      body,
      accessToken,
    });

    const verification = response.data?.data?.verifiedKey;
    if (response.data?.code !== 'SUCCESS' || !verification) {
      throw new Error(response.data?.message || 'PaymentHot implore transfer failed');
    }

    return String(verification);
  }

  private async requestWithSignature(params: {
    method: 'GET' | 'POST';
    path: string;
    body?: any;
    accessToken?: string;
    verification?: string;
  }) {
    const headers: Record<string, string> = {
      'p-request-id': crypto.randomUUID(),
      'p-request-time': this.getRequestTimeUtc7(),
      'p-tenant': this.tenant,
      'Content-Type': 'application/json',
    };

    if (params.accessToken) {
      headers.Authorization = `Bearer ${params.accessToken}`;
    }
    if (params.verification) {
      headers.verification = params.verification;
    }

    headers['p-signature'] = this.generateApiSignature(headers, params.body);

    return axios.request({
      method: params.method,
      url: `${this.baseUrl.replace(/\/+$/, '')}${params.path}`,
      headers,
      data: params.body,
    });
  }

  private generateApiSignature(
    headers: Record<string, string>,
    body?: Record<string, any>,
  ): string {
    if (!this.privateKey) {
      throw new Error('PAYMENTHOT_PRIVATE_KEY is required');
    }

    const signedHeaderKeys = Object.keys(headers)
      .filter((key) => {
        const normalized = key.toLowerCase();
        return (
          normalized === 'authorization' ||
          normalized === 'verification' ||
          normalized.startsWith('p-')
        );
      })
      .sort((a, b) => a.localeCompare(b));

    const headerValues = signedHeaderKeys.map((key) => headers[key]).join('');
    const bodyString = body ? JSON.stringify(body) : '';
    const payload = `${headerValues}${bodyString}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(payload);
    signer.end();
    return signer.sign(this.privateKey, 'base64');
  }

  private generateRedirectSignature(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort((a, b) => a.localeCompare(b));
    const joinedValues = sortedKeys.map((key) => params[key]).join('');
    const payload = `${joinedValues}${this.merchantKey}`;
    return crypto.createHash('sha256').update(payload, 'utf8').digest('base64');
  }

  private generateWebhookSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const toHash = `${payloadString}${secret}`;
    return crypto.createHash('sha256').update(toHash, 'utf8').digest('base64');
  }

  private sha256HexBase64(value: string): string {
    const hexDigest = crypto.createHash('sha256').update(value, 'utf8').digest('hex');
    return Buffer.from(hexDigest, 'utf8').toString('base64');
  }

  private getRequestTimeUtc7(): string {
    const utcPlus7 = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = utcPlus7.getUTCFullYear();
    const month = String(utcPlus7.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcPlus7.getUTCDate()).padStart(2, '0');
    const hour = String(utcPlus7.getUTCHours()).padStart(2, '0');
    const minute = String(utcPlus7.getUTCMinutes()).padStart(2, '0');
    const second = String(utcPlus7.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  private generateAuditNumber(): string {
    const randomTail = Math.floor(Math.random() * 1_000_000_000)
      .toString()
      .padStart(9, '0');
    return `${Date.now()}${randomTail}`.slice(0, 16);
  }

  private normalizeAmount(amount: number): string {
    return Math.round(Number(amount)).toString();
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) {
      return false;
    }
    return crypto.timingSafeEqual(left, right);
  }
}
