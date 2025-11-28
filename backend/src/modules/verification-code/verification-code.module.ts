import { Module } from '@nestjs/common';
import { VerificationCodeRepository } from './verification-code.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [VerificationCodeRepository],
  exports: [VerificationCodeRepository],
})
export class VerificationCodeModule {}
