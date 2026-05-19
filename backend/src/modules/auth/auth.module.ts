import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerificationCodeModule } from '../verification-code/verification-code.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { RedisModule } from '../redis/redis.module';
import { AuthTokenService } from './auth-token.service';
import { AuthSessionService } from './auth-session.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/guards/optional-jwt-auth.guard';

@Global()
@Module({
  imports: [
    VerificationCodeModule,
    UserModule,
    PrismaModule,
    ElasticsearchModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthSessionService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [
    AuthService,
    AuthTokenService,
    AuthSessionService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
})
export class AuthModule {}
