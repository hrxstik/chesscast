import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthSessionService } from '../modules/auth/auth-session.service';

/** Прикрепляет user к запросу, если передан валидный Bearer JWT; иначе user отсутствует. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthRequestUser }>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return true;
    }
    const token = authHeader.slice(7);
    if (!token) {
      return true;
    }
    try {
      const payload = (await this.jwtService.verifyAsync(token)) as {
        sub: number;
        email?: string;
        platformRole?: string;
        jti?: string;
      };
      if (await this.sessions.isAccessTokenRevoked(payload.jti)) {
        return true;
      }
      request.user = {
        id: payload.sub,
        email: payload.email,
        platformRole: payload.platformRole,
      };
    } catch {
      request.user = undefined;
    }
    return true;
  }
}

export type AuthRequestUser = {
  id: number;
  email?: string;
  platformRole?: string;
};
