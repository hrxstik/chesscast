import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PlatformRole } from '@prisma/client';

export type AccessPayload = {
  sub: number;
  email: string;
  platformRole: PlatformRole;
  jti: string;
};

export type RefreshPayload = {
  sub: number;
  email: string;
  platformRole: PlatformRole;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  async generatePair(payload: Omit<AccessPayload, 'jti'>): Promise<TokenPair> {
    const accessPayload: AccessPayload = { ...payload, jti: randomUUID() };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION ?? '1h',
    });
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        platformRole: payload.platformRole,
      } satisfies RefreshPayload,
      { expiresIn: process.env.JWT_REFRESH_EXPIRATION ?? '30d' },
    );
    return { accessToken, refreshToken };
  }

  decode(token: string): Record<string, unknown> | null {
    try {
      return this.jwtService.decode(token) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  accessBlacklistTtlSeconds(accessToken: string): number {
    const decoded = this.decode(accessToken);
    const exp = decoded?.exp;
    if (typeof exp === 'number') {
      return Math.max(60, Math.ceil(exp - Date.now() / 1000));
    }
    return 60 * 60;
  }
}
