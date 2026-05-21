import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformAuditType, PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elastic: AppElasticsearchService,
    private readonly audit: PlatformAuditService,
  ) {}

  async listUsers(
    limit = 100,
    cursorId?: number,
    q?: string,
    blocked?: boolean,
  ) {
    if (q?.trim()) {
      const esRows = await this.elastic.searchUsers(q.trim(), Math.min(Math.max(limit, 1), 200));
      if (esRows) {
        const items = esRows.map((x) => ({
          id: x.id,
          name: x.name,
          email: x.email,
          blocked: x.blocked,
          blockedReason: x.blockedReason,
          platformRole: x.platformRole as PlatformRole,
          createdAt: new Date(0),
        }));
        return { items, nextCursor: null };
      }
    }
    const take = Math.min(Math.max(limit, 1), 200);
    const where: import('@prisma/client').Prisma.UserWhereInput = {
      ...(cursorId != null ? { id: { lt: cursorId } } : {}),
      ...(blocked !== undefined ? { blocked } : {}),
    };
    if (q?.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { email: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { id: 'desc' },
      take: take + 1,
      select: {
        id: true,
        name: true,
        email: true,
        blocked: true,
        blockedReason: true,
        platformRole: true,
        createdAt: true,
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }

  async setUserBlocked(
    id: number,
    blocked: boolean,
    reason: string,
    actorUserId: number,
  ) {
    const r = reason?.trim() ?? '';
    if (r.length < 3) {
      throw new BadRequestException('Укажите причину не короче 3 символов');
    }
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, blocked: true },
    });
    if (!before) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        blocked,
        blockedReason: blocked ? r : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        blocked: true,
        blockedReason: true,
        platformRole: true,
      },
    });
    await this.elastic.indexUser({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      blocked: updated.blocked,
      blockedReason: updated.blockedReason,
      platformRole: updated.platformRole,
    });
    await this.audit.log({
      type: PlatformAuditType.MODERATION,
      action: blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
      message: blocked
        ? `Пользователь ${updated.email} заблокирован: ${r}`
        : `Пользователь ${updated.email} разблокирован: ${r}`,
      actorUserId,
      targetType: 'user',
      targetId: id,
      metadata: { reason: r, email: updated.email, name: updated.name },
    });
    return { id: updated.id, blocked: updated.blocked, blockedReason: updated.blockedReason };
  }

  async listOrganizations(
    limit = 100,
    cursorId?: number,
    q?: string,
    blocked?: boolean,
  ) {
    if (q?.trim()) {
      const esRows = await this.elastic.searchOrganizations(
        q.trim(),
        Math.min(Math.max(limit, 1), 200),
      );
      if (esRows) {
        const items = esRows.map((x) => ({
          id: x.id,
          name: x.name,
          blocked: x.blocked,
          blockedReason: x.blockedReason,
          inviteCode: x.inviteCode,
          createdAt: new Date(0),
        }));
        return { items, nextCursor: null };
      }
    }
    const take = Math.min(Math.max(limit, 1), 200);
    const where: import('@prisma/client').Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(cursorId != null ? { id: { lt: cursorId } } : {}),
      ...(blocked !== undefined ? { blocked } : {}),
    };
    if (q?.trim()) {
      where.name = { contains: q.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.organization.findMany({
      where,
      orderBy: { id: 'desc' },
      take: take + 1,
      select: {
        id: true,
        name: true,
        blocked: true,
        blockedReason: true,
        inviteCode: true,
        createdAt: true,
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }

  async setOrganizationBlocked(
    id: number,
    blocked: boolean,
    reason: string,
    actorUserId: number,
  ) {
    const r = reason?.trim() ?? '';
    if (r.length < 3) {
      throw new BadRequestException('Укажите причину не короче 3 символов');
    }
    const exists = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!exists) throw new NotFoundException('Organization not found');
    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        blocked,
        blockedReason: blocked ? r : null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        blocked: true,
        blockedReason: true,
        inviteCode: true,
        joinPolicy: true,
      },
    });
    await this.elastic.indexOrganization({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      blocked: updated.blocked,
      blockedReason: updated.blockedReason,
      inviteCode: updated.inviteCode,
      joinPolicy: updated.joinPolicy,
    });
    await this.audit.log({
      type: PlatformAuditType.MODERATION,
      action: blocked ? 'ORG_BLOCKED' : 'ORG_UNBLOCKED',
      message: blocked
        ? `Организация «${updated.name}» заблокирована: ${r}`
        : `Организация «${updated.name}» разблокирована: ${r}`,
      actorUserId,
      targetType: 'organization',
      targetId: id,
      metadata: { reason: r, name: updated.name },
    });
    return { id: updated.id, blocked: updated.blocked, blockedReason: updated.blockedReason };
  }

  async listServiceLogs(limit = 50, type?: string, cursorId?: number) {
    const auditType =
      type?.trim() && Object.values(PlatformAuditType).includes(type.trim() as PlatformAuditType)
        ? (type.trim() as PlatformAuditType)
        : undefined;
    return this.audit.list({
      limit,
      type: auditType,
      cursorId,
    });
  }
}
