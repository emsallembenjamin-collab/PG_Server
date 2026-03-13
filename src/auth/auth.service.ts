import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Admin, AdminStatus } from '../admins/entities/admin.entity';

function buildDisplayName(email?: string, fallback = 'User') {
  const localPart = email?.split('@')[0]?.trim();
  if (!localPart) {
    return fallback;
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async validateUser(email: string, password: string): Promise<Admin | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const admin = await this.adminRepository.findOne({
      where: { email: normalizedEmail, status: AdminStatus.ACTIVE },
    });

    if (!admin) {
      return null;
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return null;
    }

    return admin;
  }

  async login(user: Pick<Admin, 'id' | 'email' | 'name'>) {
    const authUser = {
      id: user.id ?? null,
      email: user.email,
      name: user.name ?? buildDisplayName(user.email),
    };
    const payload = { email: authUser.email, name: authUser.name, sub: authUser.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: authUser,
    };
  }
}
