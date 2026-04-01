import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  function createContext(request: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  function createGuard(merchant: any) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as any;
    const merchantsService = {
      validateApiKey: jest.fn().mockResolvedValue(merchant),
    } as any;

    return {
      guard: new ApiKeyGuard(reflector, merchantsService),
      merchantsService,
    };
  }

  it('allows requests when the merchant has no whitelist configured', async () => {
    const merchant = { id: 1, whitelisted_ips: null };
    const request: any = {
      headers: { 'x-api-key': 'gpk_test' },
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    };
    const { guard } = createGuard(merchant);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.merchant).toBe(merchant);
  });

  it('allows requests from whitelisted ips', async () => {
    const merchant = { id: 1, whitelisted_ips: ['198.51.100.25'] };
    const request: any = {
      headers: { 'x-api-key': 'gpk_test' },
      ip: '::ffff:198.51.100.25',
      socket: { remoteAddress: '10.0.0.1' },
    };
    const { guard } = createGuard(merchant);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.clientIp).toBe('198.51.100.25');
  });

  it('rejects requests from non-whitelisted ips', async () => {
    const merchant = { id: 1, whitelisted_ips: ['198.51.100.25'] };
    const request: any = {
      headers: { 'x-api-key': 'gpk_test' },
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    };
    const { guard } = createGuard(merchant);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects requests with an invalid api key', async () => {
    const request: any = {
      headers: { 'x-api-key': 'gpk_bad' },
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    };
    const { guard } = createGuard(null);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
