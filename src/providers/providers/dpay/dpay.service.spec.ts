import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DpayService } from './dpay.service';

describe('DpayService', () => {
  const createService = (values: Record<string, string> = {}) => {
    const config = {
      DPAY_SECRET: 'b535e1070a',
      ...values,
    };

    const configService = {
      get: (key: string) => config[key],
    } as ConfigService;

    return new DpayService(configService);
  };

  it('generates the documented DPay signature by default', () => {
    const service = createService();
    const payload = {
      key2: 'value2',
      empty: '',
      key1: 'value1',
      zeroString: '0',
      zeroNumber: 0,
      whitespace: '   ',
      nullValue: null,
      key4: '471ba7ec',
      sign: 'should-be-ignored',
    };

    const expected = crypto
      .createHash('md5')
      .update('key1=value1&key2=value2&key4=471ba7ecb535e1070a', 'utf8')
      .digest('hex')
      .toUpperCase();

    expect((service as any).generateSignature(payload)).toBe(expected);
  });

  it('verifies webhook signatures with the same filtering and uppercase MD5 rules', () => {
    const service = createService();
    const payload = {
      merchant_num: 'M100',
      uid: 'U200',
      coin: '25',
      extend: '',
      pay_type: '0',
    };

    const signature = crypto
      .createHash('md5')
      .update('coin=25&merchant_num=M100&uid=U200b535e1070a', 'utf8')
      .digest('hex')
      .toUpperCase();

    expect(service.verifyWebhook(payload, signature, '')).toBe(true);
    expect(service.verifyWebhook(payload, 'bad-signature', '')).toBe(false);
  });
});
