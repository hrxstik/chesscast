import { Controller, Get } from '@nestjs/common';
import { AppElasticsearchService } from './elasticsearch.service';
import { Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';

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

  @Post('reindex')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async reindex() {
    return this.appElasticsearchService.reindexAll();
  }
}

