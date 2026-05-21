import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [PrismaModule],
  providers: [PlatformAuditService],
  exports: [PlatformAuditService],
})
export class AuditModule {}
