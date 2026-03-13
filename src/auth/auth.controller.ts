import {
  Controller,
  Post,
  Body,
  Get,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/api-key.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  async login(@Body() loginDto: { email: string; password: string }) {
    const admin = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.authService.login(admin);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Request() req) {
    return req.user;
  }
}
