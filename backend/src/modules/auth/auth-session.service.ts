import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { AuthTokenService } from './auth-token.service';

const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly redis: RedisService,
    private readonly tokens: AuthTokenService,
  ) {}

  private refreshKey(userId: number, refreshToken: string): string {
    return `refresh-token:${userId}:${refreshToken}`;
  }

  async storeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    await this.redis.setJson(this.refreshKey(userId, refreshToken), true, REFRESH_TTL_SEC);
  }

  async consumeRefreshToken(userId: number, refreshToken: string): Promise<boolean> {
    return this.redis.consumeKey(this.refreshKey(userId, refreshToken));
  }

  async revokeRefreshToken(userId: number, refreshToken: string): Promise<void> {
    await this.redis.del(this.refreshKey(userId, refreshToken));
  }

  async revokeAllRefreshTokens(userId: number): Promise<number> {
    return this.redis.delPattern(`refresh-token:${userId}:*`);
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    const decoded = this.tokens.decode(accessToken);
    const jti = decoded?.jti;
    if (typeof jti !== 'string') return;
    const ttl = this.tokens.accessBlacklistTtlSeconds(accessToken);
    await this.redis.setJson(`jti-blacklist:${jti}`, true, ttl);
  }

  async isAccessTokenRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti) return true;
    return Boolean(await this.redis.getJson<boolean>(`jti-blacklist:${jti}`));
  }
}
