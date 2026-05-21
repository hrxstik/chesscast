import { Module, forwardRef } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { UploadModule } from '../upload/upload.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    UploadModule,
    PrismaModule,
    ElasticsearchModule,
    forwardRef(() => GameModule),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
  exports: [OrganizationService],
})
export class OrganizationModule {}
