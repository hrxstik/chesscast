import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerificationCodeModule } from '../verification-code/verification-code.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [VerificationCodeModule, UserModule, PrismaModule, ElasticsearchModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
