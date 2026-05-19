import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginUserDto } from 'src/dtos/auth/login-user.dto';
import { RegisterUserDto } from 'src/dtos/auth/register-user.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { setAuthCookies, clearAuthCookies } from 'src/auth/auth-cookie.util';
import {
  accessTokenFromRequest,
  refreshTokenFromRequest,
} from 'src/auth/access-token-from-request.util';

type AuthReq = Request & { user: { id: number } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    setAuthCookies(res, tokens.access_token, tokens.refresh_token);
    return { user: tokens.user };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    setAuthCookies(res, tokens.access_token, tokens.refresh_token);
    return { user: tokens.user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = refreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const pair = await this.authService.refresh(refreshToken);
    setAuthCookies(res, pair.access_token, pair.refresh_token);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: AuthReq, @Res({ passthrough: true }) res: Response) {
    const accessToken = accessTokenFromRequest(req) ?? '';
    const refreshToken = refreshTokenFromRequest(req) ?? '';
    await this.authService.logout(req.user.id, accessToken, refreshToken);
    clearAuthCookies(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @Req() req: AuthReq,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = accessTokenFromRequest(req) ?? '';
    await this.authService.logoutAll(req.user.id, accessToken);
    clearAuthCookies(res);
    return { ok: true };
  }
}
