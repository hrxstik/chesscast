import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PaymentService } from './payment.service';

@Processor('subscriptions', { concurrency: 1 })
export class SubscriptionRenewalProcessor extends WorkerHost {
  constructor(private readonly payments: PaymentService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === 'renew-scan') {
      return this.payments.processDueRenewals();
    }
    return undefined;
  }
}
