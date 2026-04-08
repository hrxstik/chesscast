import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from 'src/dtos/auth/login-user.dto';
import { RegisterUserDto } from 'src/dtos/auth/register-user.dto';
import { GoogleOauthGuard } from 'src/guards/google-oauth.guard.ts';

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

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleAuthCallback(@Req() req, @Res() res) {
    const user = req.user;
    const loginResult = await this.authService.validateGoogleUser(user);

    res.cookie('jwt', loginResult.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const redirectUrl = new URL(`${process.env.NEXT_URL}/auth/google/success`);
    redirectUrl.searchParams.set('token', loginResult.access_token);
    redirectUrl.searchParams.set('id', String(loginResult.user.id));
    redirectUrl.searchParams.set('name', loginResult.user.name);
    redirectUrl.searchParams.set('email', loginResult.user.email);
    redirectUrl.searchParams.set('platformRole', loginResult.user.platformRole ?? 'USER');
    return res.redirect(redirectUrl.toString());
  }
}
