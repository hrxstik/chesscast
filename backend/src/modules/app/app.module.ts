import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from '../upload/upload.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { ChessRecognitionModule } from '../chess-recognition/chess-recognition.module';
import { GameModule } from '../game/game.module';
import { JwtModule } from '@nestjs/jwt';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { AdminModule } from '../admin/admin.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PWD || undefined,
        },
      }),
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', '..', 'uploads'),
        serveRoot: '/uploads',
      },
      {
        rootPath: join(
          __dirname,
          '..',
          '..',
          '..',
          'uploads/organizations-avatars',
        ),
        serveRoot: '/uploads/organizations-avatars',
      },
      {
        rootPath: join(__dirname, '..', '..', '..', 'uploads/users-avatars'),
        serveRoot: '/uploads/users-avatars',
      },
    ),
    UploadModule,
    AuthModule,
    PricingModule,
    ChessRecognitionModule,
    GameModule,
    ElasticsearchModule,
    AdminModule,
    SubscriptionModule,
    PaymentModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET_KEY,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
