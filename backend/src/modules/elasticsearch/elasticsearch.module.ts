import { Module } from '@nestjs/common';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AppElasticsearchService } from './elasticsearch.service';
import { ElasticsearchController } from './elasticsearch.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchReindexProcessor } from './search-reindex.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: 'search' }),
    NestElasticsearchModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const node =
          configService.get<string>('ELASTICSEARCH_NODE') ??
          'https://localhost:9200';
        const username =
          configService.get<string>('ELASTICSEARCH_USERNAME') ?? 'elastic';
        const password = configService.get<string>('ELASTICSEARCH_PASSWORD');
        const tlsInsecure =
          configService.get<string>('ELASTICSEARCH_TLS_INSECURE') === 'true';

        const base: Record<string, unknown> = { node };

        if (password) {
          base.auth = { username, password };
        }

        /** Самоподписанный сертификат ES в Docker — только для дев/LAN */
        if (node.startsWith('https://') && tlsInsecure) {
          base.tls = { rejectUnauthorized: false };
        }

        return base;
      },
    }),
  ],
  providers: [AppElasticsearchService, SearchReindexProcessor],
  controllers: [ElasticsearchController],
  exports: [AppElasticsearchService],
})
export class ElasticsearchModule {}

