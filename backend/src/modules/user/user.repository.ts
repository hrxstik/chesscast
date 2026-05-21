import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userOrganizations: true,
        userGames: {
          take: 4,
          include: {
            game: true,
          },
        },
      },
    });
  }

  async updateById(id: number, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async create(data: any) {
    return this.prisma.user.create({ data });
  }

  async deleteById(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPublicProfileById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
        userOrganizations: {
          where: { organization: { deletedAt: null } },
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                blocked: true,
                deletedAt: true,
                joinPolicy: true,
              },
            },
          },
        },
        userGames: {
          where: { game: { deletedAt: null } },
          take: 40,
          orderBy: { game: { createdAt: 'desc' } },
          select: {
            color: true,
            game: {
              select: {
                id: true,
                token: true,
                status: true,
                result: true,
                visibility: true,
                creatorId: true,
                organizationId: true,
                createdAt: true,
                organization: { select: { id: true, name: true } },
                users: { select: { userId: true } },
              },
            },
          },
        },
      },
    });
  }

  async findOrganizationIdsForUser(userId: number): Promise<number[]> {
    const rows = await this.prisma.userOrganization.findMany({
      where: { userId, organization: { deletedAt: null } },
      select: { organizationId: true },
    });
    return rows.map((r) => r.organizationId);
  }

  async getDashboardSummary(userId: number) {
    const [gamesCount, organizationsCount, currentSubscription] = await Promise.all([
      this.prisma.game.count({
        where: {
          deletedAt: null,
          OR: [{ creatorId: userId }, { users: { some: { userId } } }],
        },
      }),
      this.prisma.userOrganization.count({
        where: { userId, organization: { deletedAt: null } },
      }),
      this.prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          endAt: { gt: new Date() },
          plan: { isActive: true },
        },
        include: { plan: true },
        orderBy: { endAt: 'desc' },
      }),
    ]);

    return {
      gamesCount,
      organizationsCount,
      subscription: currentSubscription
        ? {
            status: currentSubscription.status,
            endAt: currentSubscription.endAt,
            plan: {
              code: currentSubscription.plan.code,
              title: currentSubscription.plan.title,
            },
          }
        : null,
    };
  }
}
