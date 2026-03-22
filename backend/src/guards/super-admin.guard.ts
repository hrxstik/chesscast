import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import type { AuthRequestUser } from './optional-jwt-auth.guard';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthRequestUser }>();
    const role = request.user?.platformRole as PlatformRole | undefined;
    if (role !== PlatformRole.SUPERADMIN) {
      throw new ForbiddenException('Только для супер-администратора');
    }
    return true;
  }
}
