import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BillingEventType,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { YookassaApiService } from './yookassa-api.service';

const SUBSCRIPTION_PERIOD_DAYS = 30;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YookassaApiService,
  ) {}

  async createYookassaCheckout(userId: number, planId: number) {
    if (!this.yookassa.isConfigured()) {
      throw new ServiceUnavailableException(
        'Платежи ЮKassa не настроены (переменные YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY).',
      );
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) {
      throw new BadRequestException('Тариф не найден или отключён');
    }
    const zero = new Prisma.Decimal(0);
    if (plan.priceMonthly.lte(zero)) {
      throw new BadRequestException('Этот тариф не требует оплаты');
    }

    const now = new Date();
    const activePaid = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endAt: { gt: now },
        plan: { isActive: true, code: { not: 'FREE' } },
      },
      select: { id: true },
    });
    if (activePaid) {
      throw new BadRequestException('У вас уже есть активная платная подписка');
    }

    await this.prisma.$transaction(async (tx) => {
      const pendingSubs = await tx.subscription.findMany({
        where: { userId, status: SubscriptionStatus.PAUSED },
        select: { id: true },
      });
      for (const s of pendingSubs) {
        await tx.payment.deleteMany({ where: { subscriptionId: s.id } });
        await tx.subscription.delete({ where: { id: s.id } });
      }
    });

    const endPlaceholder = new Date(now);
    endPlaceholder.setDate(endPlaceholder.getDate() + 1);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.PAUSED,
        startAt: now,
        endAt: endPlaceholder,
        autoRenew: false,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        planId: plan.id,
        amount: plan.priceMonthly,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.SUBSCRIPTION_PERSONAL,
        metadata: { source: 'yookassa_checkout' } as Prisma.InputJsonValue,
      },
    });

    const returnUrl =
      process.env.YOOKASSA_RETURN_URL ||
      `${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3000'}/dashboard/profile?payment=success`;

    const amountValue = plan.priceMonthly.toFixed(2);
    const description = `ChessCast: ${plan.title}`;

    try {
      const yk = await this.yookassa.createRedirectPayment({
        amountValue,
        currency: plan.currency,
        returnUrl,
        description,
        metadata: {
          chesscastPaymentId: String(payment.id),
          chesscastSubscriptionId: String(subscription.id),
          chesscastUserId: String(userId),
        },
      });

      const url = yk.confirmation?.confirmation_url;
      if (!url) {
        throw new Error('Нет confirmation_url в ответе ЮKassa');
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: yk.id },
      });

      return { confirmationUrl: url, paymentId: payment.id };
    } catch (e) {
      await this.prisma.payment.delete({ where: { id: payment.id } }).catch(() => undefined);
      await this.prisma.subscription
        .delete({ where: { id: subscription.id } })
        .catch(() => undefined);
      const msg = e instanceof Error ? e.message : 'Ошибка ЮKassa';
      this.logger.error(msg);
      throw new BadRequestException(
        'Не удалось создать платёж в ЮKassa. Проверьте тестовые ключи и доступность API.',
      );
    }
  }

  async handleYookassaWebhook(body: unknown): Promise<void> {
    if (!this.yookassa.isConfigured()) {
      this.logger.warn('Webhook ignored: YooKassa not configured');
      return;
    }

    const b = body as {
      event?: string;
      type?: string;
      object?: { id?: string; status?: string; metadata?: Record<string, string> };
    };
    const event = b.event;
    const ykId = b.object?.id;
    if (!ykId) {
      this.logger.warn('Webhook without payment id');
      return;
    }

    if (event === 'payment.succeeded') {
      await this.applyPaymentSucceeded(ykId);
      return;
    }
    if (event === 'payment.canceled') {
      await this.applyPaymentCanceled(ykId);
    }
  }

  private async applyPaymentSucceeded(ykPaymentId: string) {
    const remote = await this.yookassa.getPayment(ykPaymentId);
    if (remote.status !== 'succeeded' && !remote.paid) {
      this.logger.warn(`payment.succeeded webhook but remote status=${remote.status}`);
      return;
    }

    const pid = remote.metadata?.chesscastPaymentId;
    if (!pid) {
      this.logger.warn('YooKassa payment has no chesscastPaymentId in metadata');
      return;
    }

    const paymentId = parseInt(pid, 10);
    if (Number.isNaN(paymentId)) return;

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { subscription: true },
      });
      if (!payment || payment.status === PaymentStatus.SUCCEEDED) {
        return;
      }
      if (payment.providerPaymentId && payment.providerPaymentId !== ykPaymentId) {
        this.logger.warn(`Payment ${paymentId} provider id mismatch`);
        return;
      }

      const sub = payment.subscription;
      if (sub.status !== SubscriptionStatus.PAUSED) {
        return;
      }

      const now = new Date();
      const endAt = new Date(now);
      endAt.setDate(endAt.getDate() + SUBSCRIPTION_PERIOD_DAYS);

      await tx.subscription.updateMany({
        where: {
          userId: payment.userId,
          status: SubscriptionStatus.ACTIVE,
          id: { not: sub.id },
        },
        data: { status: SubscriptionStatus.CANCELED },
      });

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startAt: now,
          endAt,
          autoRenew: false,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          providerPaymentId: ykPaymentId,
        },
      });

      await tx.billingEvent.create({
        data: {
          type: BillingEventType.INVOICE_PAID,
          amount: payment.amount,
          currency: payment.currency,
          paymentId: payment.id,
          metadata: { source: 'yookassa_webhook' } as Prisma.InputJsonValue,
        },
      });
    });
  }

  private async applyPaymentCanceled(ykPaymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: ykPaymentId },
      include: { subscription: true },
    });
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.CANCELED },
      }),
    ]);
  }
}
