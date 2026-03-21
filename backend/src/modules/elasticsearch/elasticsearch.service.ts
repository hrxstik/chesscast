import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class AppElasticsearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async ping(): Promise<boolean> {
    try {
      await this.elasticsearchService.ping();
      return true;
    } catch {
      return false;
    }
  }
}

