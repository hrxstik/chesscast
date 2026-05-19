import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Organization,
  OrganizationJoinPolicy,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { OrganizationRepository } from './organization.repository';
import { CreateOrganizationDto } from 'src/dtos/create/create-organization.dto';
import generateCode from 'utils/generate-code';
import { PrismaService } from '../prisma/prisma.service';
import { AppElasticsearchService } from '../elasticsearch/elasticsearch.service';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly elastic: AppElasticsearchService,
  ) {}

  async searchOrganizations(userId: number, query?: string, organizationId?: number) {
    if (query?.trim()) {
      const esRows = await this.elastic.searchOrganizations(query.trim(), 30);
      if (esRows) {
        const filtered = organizationId
          ? esRows.filter((x) => x.id === organizationId)
          : esRows;
        return Promise.all(
          filtered.map(async (row) => {
            const member = await this.prisma.userOrganization.findUnique({
              where: { userId_organizationId: { userId, organizationId: row.id } },
              select: { role: true },
            });
            const jp = (row as { joinPolicy?: string }).joinPolicy ?? 'INVITE_ONLY';
            return {
              id: row.id,
              name: row.name,
              description: row.description,
              blocked: row.blocked,
              blockedReason: row.blockedReason,
              inviteCode: member ? row.inviteCode : undefined,
              joinPolicy: jp,
              isMember: !!member,
              role: member?.role ?? null,
              isActive: await this.isOrganizationActive(row.id),
            };
          }),
        );
      }
    }
    const where: import('@prisma/client').Prisma.OrganizationWhereInput = {
      deletedAt: null,
    };
    if (organizationId != null) {
      where.id = organizationId;
    } else if (query && query.trim()) {
      where.name = { contains: query.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.organization.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 30,
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
    return Promise.all(
      rows.map(async (row) => {
        const member = await this.prisma.userOrganization.findUnique({
          where: { userId_organizationId: { userId, organizationId: row.id } },
          select: { role: true },
        });
        return {
          ...row,
          inviteCode: member ? row.inviteCode : undefined,
          joinPolicy: row.joinPolicy,
          isMember: !!member,
          role: member?.role ?? null,
          isActive: await this.isOrganizationActive(row.id),
        };
      }),
    );
  }

  async findById(id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return organization;
  }

  /** Карточка для неучастников: при INVITE_ONLY — минимум полей; при OPEN — описание без кода. */
  async getOrganizationVisible(id: number, viewerUserId?: number) {
    const organization = await this.organizationRepository.findById(id);
    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    const member =
      viewerUserId != null
        ? await this.organizationRepository.isUserMember(viewerUserId, id)
        : false;
    if (member) {
      return organization;
    }
    if (organization.joinPolicy === OrganizationJoinPolicy.INVITE_ONLY) {
      return {
        id: organization.id,
        name: organization.name,
        avatar: organization.avatar,
        joinPolicy: organization.joinPolicy,
        blocked: organization.blocked,
      };
    }
    return {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      avatar: organization.avatar,
      joinPolicy: organization.joinPolicy,
      blocked: organization.blocked,
    };
  }

  async joinOpenOrganization(userId: number, organizationId: number) {
    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization || organization.deletedAt) {
      throw new NotFoundException(`Organization with id ${organizationId} not found`);
    }
    if (organization.joinPolicy !== OrganizationJoinPolicy.OPEN) {
      throw new BadRequestException(
        'Без пригласительного кода можно вступить только в организации с типом «открытая»',
      );
    }
    if (organization.blocked || !(await this.isOrganizationActive(organizationId))) {
      throw new ForbiddenException('Организация временно недоступна');
    }
    await this.organizationRepository.addMember(userId, organizationId);
    return this.findById(organizationId);
  }

  async updateById(id: number, data: any): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    const updated = await this.organizationRepository.updateById(id, data);
    await this.elastic.indexOrganization({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      blocked: updated.blocked,
      blockedReason: updated.blockedReason,
      inviteCode: updated.inviteCode,
      joinPolicy: updated.joinPolicy,
    });
    return updated;
  }

  async create(data: CreateOrganizationDto, creatorUserId: number): Promise<Organization> {
    const activeSubscription = await this.getActiveSubscriptionWithPlan(creatorUserId);
    if (!activeSubscription) {
      throw new ForbiddenException('Нужна активная подписка для создания организации');
    }
    if (!activeSubscription.plan.canCreateOrganization) {
      throw new ForbiddenException('Текущий тариф не позволяет создавать организации');
    }

    const createdOrganizations = await this.prisma.userOrganization.count({
      where: {
        userId: creatorUserId,
        role: Role.ADMIN,
        organization: { deletedAt: null },
      },
    });
    if (createdOrganizations >= activeSubscription.plan.maxOrganizations) {
      throw new ForbiddenException('Достигнут лимит организаций для текущего тарифа');
    }

    const joinPolicy = data.joinPolicy ?? OrganizationJoinPolicy.INVITE_ONLY;
    const createData = {
      name: data.name,
      description: data.description,
      avatar: data.avatar,
      joinPolicy,
      owner: { connect: { id: creatorUserId } },
      inviteCode: await generateCode(6),
      users: {
        create: {
          userId: creatorUserId,
          role: Role.ADMIN,
        },
      },
    };
    const created = await this.organizationRepository.create(createData);
    await this.elastic.indexOrganization({
      id: created.id,
      name: created.name,
      description: created.description,
      blocked: created.blocked,
      blockedReason: created.blockedReason,
      inviteCode: created.inviteCode,
      joinPolicy: created.joinPolicy,
    });
    return created;
  }

  async recreateInviteCode(id: number): Promise<Organization> {
    const organization = await this.organizationRepository.findById(id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    const updated = await this.organizationRepository.updateById(id, {
      inviteCode: await generateCode(6),
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
    return updated;
  }

  async deleteById(id: number): Promise<Organization> {
    await this.findById(id);
    const deleted = await this.organizationRepository.deleteById(id);
    await this.elastic.removeOrganization(id);
    return deleted;
  }

  async isUserMember(userId: number, organizationId: number): Promise<boolean> {
    return this.organizationRepository.isUserMember(userId, organizationId);
  }

  async assertUserHasAccess(userId: number, organizationId: number): Promise<void> {
    if (!userId) throw new UnauthorizedException();
    const isMember = await this.organizationRepository.isUserMember(userId, organizationId);
    if (!isMember) {
      throw new ForbiddenException('Нет доступа к организации');
    }
  }

  async assertUserIsAdmin(userId: number, organizationId: number): Promise<void> {
    const organization = await this.findById(organizationId);
    if (organization.ownerUserId !== userId) {
      throw new ForbiddenException('Недостаточно прав: нужен администратор организации');
    }
  }

  async assertOrganizationActiveForActions(organizationId: number): Promise<void> {
    const isActive = await this.isOrganizationActive(organizationId);
    if (!isActive) {
      throw new ForbiddenException(
        'Организация неактивна: продлите подписку владельца для выполнения действий',
      );
    }
  }

  async listMyOrganizations(userId: number) {
    const rows = await this.organizationRepository.findManyByUserId(userId);
    return Promise.all(
      rows.map(async (r) => ({
        id: r.organization.id,
        name: r.organization.name,
        description: r.organization.description,
        inviteCode: r.organization.inviteCode,
        joinPolicy: r.organization.joinPolicy,
        role: r.role,
        isActive: await this.isOrganizationActive(r.organization.id),
      })),
    );
  }

  async joinByInviteCode(userId: number, inviteCode: string) {
    const organization = await this.organizationRepository.findByInviteCode(
      inviteCode.trim(),
    );
    if (!organization) {
      throw new NotFoundException('Организация с таким кодом не найдена');
    }
    if (organization.blocked || !(await this.isOrganizationActive(organization.id))) {
      throw new ForbiddenException('Организация временно заблокирована');
    }
    await this.organizationRepository.addMember(userId, organization.id);
    return this.findById(organization.id);
  }

  async getMembers(organizationId: number, requesterUserId: number) {
    await this.assertUserHasAccess(requesterUserId, organizationId);
    const exists = await this.findById(organizationId);
    if (!exists) {
      throw new NotFoundException(`Organization with id ${organizationId} not found`);
    }
    const members = await this.organizationRepository.getMembers(organizationId);
    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: m.user,
    }));
  }

  async getGames(
    organizationId: number,
    requesterUserId: number,
    filters?: { status?: string; mode?: string; from?: string; to?: string },
  ) {
    await this.assertUserHasAccess(requesterUserId, organizationId);
    const exists = await this.findById(organizationId);
    if (!exists) {
      throw new NotFoundException(`Organization with id ${organizationId} not found`);
    }
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(filters.to) : undefined;
    return this.organizationRepository.getGames(organizationId, requesterUserId, {
      status: filters?.status,
      mode: filters?.mode,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    });
  }

  async getLogs(
    organizationId: number,
    requesterUserId: number,
    filters?: { type?: string; from?: string; to?: string },
  ) {
    await this.assertUserHasAccess(requesterUserId, organizationId);
    const org = await this.findById(organizationId);
    const games = await this.organizationRepository.getGames(
      organizationId,
      requesterUserId,
      {
        from: filters?.from ? new Date(filters.from) : undefined,
        to: filters?.to ? new Date(filters.to) : undefined,
      },
    );
    const logs = [
      {
        type: 'ORGANIZATION_CREATED',
        createdAt: org.createdAt,
        actor: null as null | { id: number; name: string },
        payload: { organizationId },
      },
      ...games.map((g) => ({
        type: 'GAME_CREATED',
        createdAt: g.createdAt,
        actor: null as null | { id: number; name: string },
        payload: { gameId: g.id, token: g.token, mode: g.mode },
      })),
    ];
    const sorted = logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (filters?.type) {
      return sorted.filter((x) => x.type === filters.type);
    }
    return sorted;
  }

  async removeMember(
    organizationId: number,
    targetUserId: number,
    requesterUserId: number,
  ) {
    await this.assertUserIsAdmin(requesterUserId, organizationId);
    await this.assertOrganizationActiveForActions(organizationId);
    const organization = await this.findById(organizationId);
    if (targetUserId === organization.ownerUserId) {
      throw new ForbiddenException('Нельзя удалить владельца организации');
    }
    const target = await this.organizationRepository.getMember(targetUserId, organizationId);
    if (!target) {
      throw new NotFoundException('Участник не найден');
    }
    return this.organizationRepository.removeMember(targetUserId, organizationId);
  }

  async getActiveSubscriptionWithPlan(userId: number) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endAt: { gt: now },
      },
      include: { plan: true },
      orderBy: { endAt: 'desc' },
    });
  }

  async isOrganizationActive(organizationId: number): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerUserId: true, blocked: true },
    });
    if (!organization) {
      return false;
    }

    const now = new Date();
    const activeOwnerSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: organization.ownerUserId,
        status: SubscriptionStatus.ACTIVE,
        endAt: { gt: now },
        plan: { canCreateOrganization: true },
      },
      select: { id: true },
    });
    return !organization.blocked && !!activeOwnerSubscription;
  }
}
