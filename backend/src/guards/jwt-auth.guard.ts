import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthSessionService } from '../modules/auth/auth-session.service';
import { AUTH_COOKIE_NAMES } from '../auth/auth-cookie.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    const bearer =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : null;
    const cookie = request.cookies?.[AUTH_COOKIE_NAMES.access];
    const fromCookie =
      typeof cookie === 'string' && cookie.length > 0 ? cookie : null;
    const candidates = [bearer, fromCookie].filter(
      (t): t is string => !!t,
    );

    if (candidates.length === 0) {
      throw new UnauthorizedException('Authorization token missing');
    }

    let lastErr: unknown;
    for (const token of candidates) {
      try {
        const payload = (await this.jwtService.verifyAsync(token)) as {
          sub: number | string;
          email?: string;
          platformRole?: string;
          jti?: string;
        };

        if (await this.sessions.isAccessTokenRevoked(payload.jti)) {
          throw new UnauthorizedException('Token revoked');
        }

        const sub =
          typeof payload.sub === 'number'
            ? payload.sub
            : Number(String(payload.sub).trim());
        if (!Number.isFinite(sub)) {
          throw new UnauthorizedException('Invalid or expired JWT token');
        }

        request['user'] = {
          id: sub,
          email: payload.email,
          platformRole: payload.platformRole,
        };
        return true;
      } catch (err) {
        lastErr = err;
        if (err instanceof UnauthorizedException) throw err;
      }
    }

    if (lastErr instanceof UnauthorizedException) throw lastErr;
    throw new UnauthorizedException('Invalid or expired JWT token');
  }
}
