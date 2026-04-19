import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/** Кладёт задачу в Redis-очередь; исполняет воркер (SubscriptionRenewalProcessor). */
@Injectable()
export class SubscriptionRenewalCron {
  private readonly logger = new Logger(SubscriptionRenewalCron.name);

  constructor(@InjectQueue('subscriptions') private readonly queue: Queue) {}

  @Cron('*/15 * * * *')
  async enqueue(): Promise<void> {
    if (process.env.DISABLE_SUBSCRIPTION_RENEWAL_CRON === 'true') return;
    try {
      await this.queue.add('renew-scan', {}, { removeOnComplete: 200 });
    } catch (e) {
      this.logger.warn(
        `Очередь автопродлений недоступна (Redis?): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
