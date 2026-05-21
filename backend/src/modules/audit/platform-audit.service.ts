import { Injectable } from '@nestjs/common';
import { PlatformAuditType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogInput = {
  type: PlatformAuditType;
  action: string;
  message: string;
  actorUserId?: number;
  targetType?: string;
  targetId?: number;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.platformAuditLog.create({
      data: {
        type: input.type,
        action: input.action,
        message: input.message,
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
      },
    });
  }

  async list(params: {
    limit?: number;
    type?: PlatformAuditType;
    cursorId?: number;
  }) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const where: Prisma.PlatformAuditLogWhereInput = {
      ...(params.cursorId != null ? { id: { lt: params.cursorId } } : {}),
      ...(params.type ? { type: params.type } : {}),
    };
    const rows = await this.prisma.platformAuditLog.findMany({
      where,
      orderBy: { id: 'desc' },
      take: take + 1,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.type,
        action: r.action,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        actorName: r.actor?.name ?? 'system',
        actorEmail: r.actor?.email ?? null,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: r.metadata,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
      stub: false as const,
    };
  }
}
