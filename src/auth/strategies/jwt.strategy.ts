import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin, AdminStatus } from '../../admins/entities/admin.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required. Set it in .env or .env.local',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const adminId = Number(payload?.sub);
    if (!Number.isInteger(adminId) || adminId <= 0) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    const admin = await this.adminRepository.findOne({
      where: { id: adminId, status: AdminStatus.ACTIVE },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account is inactive or no longer exists');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      status: admin.status,
    };
  }
}
