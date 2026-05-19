import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthSessionService } from '../modules/auth/auth-session.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token missing or malformed');
    }

    try {
      const payload = (await this.jwtService.verifyAsync(token)) as {
        sub: number;
        email?: string;
        platformRole?: string;
        jti?: string;
      };

      if (await this.sessions.isAccessTokenRevoked(payload.jti)) {
        throw new UnauthorizedException('Token revoked');
      }

      request['user'] = {
        id: payload.sub,
        email: payload.email,
        platformRole: payload.platformRole,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired JWT token');
    }
  }
}
