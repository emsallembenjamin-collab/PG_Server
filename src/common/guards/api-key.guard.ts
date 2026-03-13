import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_API_KEY } from '../decorators/api-key.decorator';
import { MerchantsService } from '../../merchants/merchants.service';

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
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const merchant = await this.merchantsService.validateApiKey(apiKey);
    if (!merchant) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.merchant = merchant;
    return true;
  }
}
