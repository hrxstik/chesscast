import { Injectable } from '@nestjs/common';
import { Game, GameMode, GameResult, GameStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const gameWithAccessInclude = {
  organization: true,
  users: {
    include: {
      user: true,
    },
  },
} as const;

export type GameWithAccess = Prisma.GameGetPayload<{
  include: typeof gameWithAccessInclude;
}>;

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { id },
      include: {
        organization: true,
        users: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findByToken(token: string): Promise<GameWithAccess | null> {
    return this.prisma.game.findUnique({
      where: { token },
      include: gameWithAccessInclude,
    });
  }

  /** Публичная сессия без паролей и лишних полей пользователя */
  async findSessionPublicByToken(token: string) {
    return this.prisma.game.findFirst({
      where: { token, deletedAt: null },
      select: {
        id: true,
        token: true,
        mode: true,
        result: true,
        status: true,
        visibility: true,
        initialPosition: true,
        moves: true,
        createdAt: true,
        organization: { select: { id: true, name: true } },
        users: {
          select: {
            color: true,
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });
  }

  async findManyByUserIdPaginated(
    userId: number,
    skip = 0,
    take = 10,
  ): Promise<Game[]> {
    return this.prisma.game.findMany({
      where: {
        OR: [{ creatorId: userId }, { users: { some: { userId } } }],
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
      include: {
        organization: true,
        users: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /** Cursor = id of last item from previous page (exclusive). Ordered by id desc. */
  async findManyByUserIdCursor(
    userId: number,
    take: number,
    cursorId?: number,
    filters?: {
      status?: string;
      mode?: string;
      organizationId?: number;
      result?: string;
      token?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<Game[]> {
    const where: Prisma.GameWhereInput = {
      OR: [{ creatorId: userId }, { users: { some: { userId } } }],
      deletedAt: null,
      ...(cursorId != null ? { id: { lt: cursorId } } : {}),
    };
    if (filters?.status && Object.values(GameStatus).includes(filters.status as GameStatus)) {
      where.status = filters.status as GameStatus;
    }
    if (filters?.mode && Object.values(GameMode).includes(filters.mode as GameMode)) {
      where.mode = filters.mode as GameMode;
    }
    if (filters?.organizationId != null) {
      where.organizationId = filters.organizationId;
    }
    if (filters?.result && Object.values(GameResult).includes(filters.result as GameResult)) {
      where.result = filters.result as GameResult;
    }
    if (filters?.token?.trim()) {
      where.token = { contains: filters.token.trim(), mode: 'insensitive' };
    }
    if (filters?.from || filters?.to) {
      where.createdAt = {
        gte: filters.from,
        lte: filters.to,
      };
    }
    return this.prisma.game.findMany({
      where,
      orderBy: { id: 'desc' },
      take,
      include: {
        organization: true,
        users: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.GameCreateInput): Promise<Game> {
    return this.prisma.game.create({
      data,
      include: {
        organization: true,
        users: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async deleteById(id: number): Promise<Game> {
    return this.prisma.game.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
