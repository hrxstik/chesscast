import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppElasticsearchService } from './elasticsearch.service';

@Processor('search', { concurrency: 1 })
export class SearchReindexProcessor extends WorkerHost {
  constructor(private readonly elasticsearch: AppElasticsearchService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'reindex-all') {
      return this.elasticsearch.reindexAll();
    }
    return undefined;
  }
}
