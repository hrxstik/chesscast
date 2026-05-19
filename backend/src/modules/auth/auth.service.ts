import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../user/user.repository';
import { RegisterUserDto } from 'src/dtos/auth/register-user.dto';
import { User } from '@prisma/client';
import { LoginUserDto } from 'src/dtos/auth/login-user.dto';
import * as bcrypt from 'bcrypt';
import { AppElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { AuthTokenService } from './auth-token.service';
import { AuthSessionService } from './auth-session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
    private readonly elastic: AppElasticsearchService,
    private readonly authTokens: AuthTokenService,
    private readonly sessions: AuthSessionService,
  ) {}

  private async issueTokens(user: User) {
    const { accessToken, refreshToken } = await this.authTokens.generatePair({
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
    });
    await this.sessions.storeRefreshToken(user.id, refreshToken);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
      },
    };
  }

  async login(dto: LoginUserDto) {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('Аккаунт удален');
    }
    if (user.blocked) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }
    if (!user.password) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueTokens(user);
  }

  async register(dto: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    if (dto.password !== dto.passwordRepeat) {
      throw new UnauthorizedException('Passwords do not match');
    }

    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newUser = await this.userRepository.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
        },
      });
      await this.elastic.indexUser({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        blocked: newUser.blocked,
        blockedReason: newUser.blockedReason,
        platformRole: newUser.platformRole,
      });

      return this.issueTokens(newUser);
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async refresh(refreshToken: string) {
    let payload: { sub?: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const consumed = await this.sessions.consumeRefreshToken(userId, refreshToken);
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(userId);
    if (!user || user.deletedAt || user.blocked) {
      throw new UnauthorizedException('Аккаунт недоступен');
    }

    const { accessToken, refreshToken: newRefresh } =
      await this.authTokens.generatePair({
        sub: user.id,
        email: user.email,
        platformRole: user.platformRole,
      });
    await this.sessions.storeRefreshToken(user.id, newRefresh);

    return {
      access_token: accessToken,
      refresh_token: newRefresh,
    };
  }

  async logout(userId: number, accessToken: string, refreshToken: string) {
    if (accessToken) {
      await this.sessions.revokeAccessToken(accessToken);
    }
    if (refreshToken) {
      await this.sessions.revokeRefreshToken(userId, refreshToken);
    }
    return { ok: true };
  }

  async logoutAll(userId: number, accessToken?: string) {
    if (accessToken) {
      await this.sessions.revokeAccessToken(accessToken);
    }
    await this.sessions.revokeAllRefreshTokens(userId);
    return { ok: true };
  }

  async validateUserById(userId: number): Promise<User | null> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.deletedAt || user.blocked) return null;
    return user;
  }
}
