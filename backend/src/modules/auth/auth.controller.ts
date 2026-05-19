import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from 'src/dtos/auth/login-user.dto';
import { RegisterUserDto } from 'src/dtos/auth/register-user.dto';
import { RefreshTokenDto } from 'src/dtos/auth/refresh-token.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

type AuthReq = Request & { user: { id: number } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: AuthReq,
    @Body() body: { refresh_token?: string },
  ) {
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';
    return this.authService.logout(
      req.user.id,
      accessToken,
      body.refresh_token ?? '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: AuthReq) {
    const authHeader = req.headers.authorization ?? '';
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';
    return this.authService.logoutAll(req.user.id, accessToken);
  }
}
