import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerificationCodeModule } from '../verification-code/verification-code.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleStrategy } from 'src/strategies/google.strategy';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [VerificationCodeModule, UserModule, PrismaModule, ElasticsearchModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
})
export class AuthModule {}
