import { Controller, Get } from '@nestjs/common';
import { AppElasticsearchService } from './elasticsearch.service';

@Controller('elasticsearch')
export class ElasticsearchController {
  constructor(
    private readonly appElasticsearchService: AppElasticsearchService,
  ) {}

  @Get('health')
  async health() {
    const ok = await this.appElasticsearchService.ping();
    return { ok };
  }
}

