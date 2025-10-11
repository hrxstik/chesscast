import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import googleConfig from '../../config/config';
import { UploadModule } from '../upload/upload.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [googleConfig],
      isGlobal: true,
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
