import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppElasticsearchService } from './elasticsearch.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';

@Controller('elasticsearch')
export class ElasticsearchController {
  constructor(
    private readonly appElasticsearchService: AppElasticsearchService,
    @InjectQueue('search') private readonly searchQueue: Queue,
  ) {}

  @Get('health')
  async health() {
    const ok = await this.appElasticsearchService.ping();
    return { ok };
  }

  @Post('reindex')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async reindex() {
    await this.searchQueue.add('reindex-all', {}, { removeOnComplete: 50 });
    return { ok: true, queued: true };
  }
}

