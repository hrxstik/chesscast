import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './user.repository';
import { UploadModule } from '../upload/upload.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [UploadModule, ElasticsearchModule],
  controllers: [UserController],
  providers: [UserService, PrismaService, UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
