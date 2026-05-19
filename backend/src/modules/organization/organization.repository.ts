import { Injectable } from '@nestjs/common';
import {
  GameMode,
  GameStatus,
  GameVisibility,
  Organization,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findById(id: number): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async updateById(id: number, data: any) {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async create(data: Prisma.OrganizationCreateInput) {
    return this.prisma.organization.create({ data });
  }

  async findManyByUserId(userId: number) {
    return this.prisma.userOrganization.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: {
        organization: true,
      },
      orderBy: { organizationId: 'desc' },
    });
  }

  async findByInviteCode(inviteCode: string) {
    return this.prisma.organization.findFirst({
      where: { inviteCode, deletedAt: null },
    });
  }

  async addMember(userId: number, organizationId: number) {
    return this.prisma.userOrganization.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      update: {},
      create: { userId, organizationId, role: 'PLAYER' },
    });
  }

  async getMembers(organizationId: number) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { userId: 'asc' },
    });
  }

  async getMember(userId: number, organizationId: number) {
    return this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  async removeMember(userId: number, organizationId: number) {
    return this.prisma.userOrganization.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  async getGames(
    organizationId: number,
    requesterUserId: number,
    filters?: {
      status?: string;
      mode?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const where: Prisma.GameWhereInput = {
      organizationId,
      deletedAt: null,
      OR: [
        { visibility: GameVisibility.PUBLIC },
        { creatorId: requesterUserId },
        { users: { some: { userId: requesterUserId } } },
      ],
    };
    if (filters?.status && Object.values(GameStatus).includes(filters.status as GameStatus)) {
      where.status = filters.status as GameStatus;
    }
    if (filters?.mode && Object.values(GameMode).includes(filters.mode as GameMode)) {
      where.mode = filters.mode as GameMode;
    }
    if (filters?.from || filters?.to) {
      where.createdAt = {
        gte: filters.from,
        lte: filters.to,
      };
    }
    return this.prisma.game.findMany({
      where,
      select: {
        id: true,
        token: true,
        mode: true,
        status: true,
        visibility: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async deleteById(id: number) {
    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async isUserMember(userId: number, organizationId: number): Promise<boolean> {
    const row = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    return !!row;
  }
}
