import { Module } from '@nestjs/common';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { AppElasticsearchService } from './elasticsearch.service';
import { ElasticsearchController } from './elasticsearch.controller';

@Module({
  imports: [
    NestElasticsearchModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const node =
          configService.get<string>('ELASTICSEARCH_NODE') ??
          'http://localhost:9200';
        const username = configService.get<string>('ELASTICSEARCH_USERNAME');
        const password = configService.get<string>('ELASTICSEARCH_PASSWORD');

        if (username && password) {
          return {
            node,
            auth: { username, password },
          };
        }

        return { node };
      },
    }),
  ],
  providers: [AppElasticsearchService],
  controllers: [ElasticsearchController],
  exports: [AppElasticsearchService],
})
export class ElasticsearchModule {}

