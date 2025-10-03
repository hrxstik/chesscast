import { Module } from '@nestjs/common';
import { VerificationCodeRepository } from './verification-code.repository';

@Module({
  providers: [VerificationCodeRepository],
  exports: [VerificationCodeRepository],
})
export class VerificationCodeModule {}
