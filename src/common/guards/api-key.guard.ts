import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_API_KEY } from '../decorators/api-key.decorator';
import { MerchantsService } from '../../merchants/merchants.service';
import { extractMerchantApiKey } from '../utils/api-key-extract.util';
import { isIpWhitelisted, normalizeIp } from '../utils/ip.utils';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private merchantsService: MerchantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isApiKey = this.reflector.getAllAndOverride<boolean>(IS_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = extractMerchantApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const merchant = await this.merchantsService.validateApiKey(apiKey);
    if (!merchant) {
      throw new UnauthorizedException('Invalid API key');
    }

    const whitelistedIps = Array.isArray(merchant.whitelisted_ips)
      ? merchant.whitelisted_ips
      : [];

    if (whitelistedIps.length > 0) {
      const requestIp = normalizeIp(request.ip) || normalizeIp(request.socket?.remoteAddress);
      if (!requestIp || !isIpWhitelisted(requestIp, whitelistedIps)) {
        throw new ForbiddenException('Request IP is not whitelisted');
      }
      request.clientIp = requestIp;
    }

    request.merchant = merchant;
    return true;
  }
}
