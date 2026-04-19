import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(fromIso?: string, toIso?: string) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromIso) {
      const d = new Date(fromIso);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (toIso) {
      const d = new Date(toIso);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    const dateWhere =
      Object.keys(createdAt).length > 0 ? { createdAt } : {};

    const succeeded = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, ...dateWhere },
      _sum: { amount: true },
      _count: true,
    });

    const refunds = await this.prisma.payment.count({
      where: { status: PaymentStatus.REFUNDED, ...dateWhere },
    });

    return {
      revenue: succeeded._sum.amount?.toString() ?? '0',
      currency: 'RUB',
      paymentCount: succeeded._count,
      refunds,
    };
  }

  async listEvents(limit: number, cursorId?: number) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.billingEvent.findMany({
      where: cursorId != null ? { id: { lt: cursorId } } : {},
      orderBy: { id: 'desc' },
      take: take + 1,
      include: {
        payment: { select: { id: true, status: true, purpose: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor =
      hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items: items.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount?.toString() ?? null,
        currency: e.currency,
        createdAt: e.createdAt,
        paymentId: e.paymentId,
        payment: e.payment,
        actor: e.actor,
        metadata: e.metadata,
      })),
      nextCursor,
    };
  }

  /** Экспорт ленты биллинг-событий в CSV (UTF-8 BOM для Excel). */
  async exportEventsCsv(): Promise<string> {
    const rows = await this.prisma.billingEvent.findMany({
      orderBy: { id: 'desc' },
      take: 5000,
      include: {
        payment: { select: { id: true, status: true, purpose: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = ['id', 'type', 'amount', 'currency', 'createdAt', 'paymentId', 'actorUserId', 'actorName', 'paymentStatus'];
    const lines = [header.join(',')];
    for (const e of rows) {
      lines.push(
        [
          e.id,
          esc(e.type),
          esc(e.amount?.toString() ?? ''),
          esc(e.currency ?? ''),
          e.createdAt.toISOString(),
          e.paymentId ?? '',
          e.actorUserId ?? '',
          esc(e.actor?.name ?? ''),
          esc(e.payment?.status ?? ''),
        ].join(','),
      );
    }
    return '\uFEFF' + lines.join('\n');
  }
}
