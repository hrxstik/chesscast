import { Injectable } from '@nestjs/common';
import { Game, GameResult, GameStatus, Prisma } from '@prisma/client';
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

  async updateStatusByToken(token: string, status: GameStatus): Promise<void> {
    await this.prisma.game.updateMany({
      where: { token, deletedAt: null },
      data: { status },
    });
  }

  /** Добавляет SAN-ход, если он отличается от последнего записанного. */
  async appendSanMoveByToken(token: string, san: string): Promise<boolean> {
    const game = await this.prisma.game.findFirst({
      where: { token, deletedAt: null },
      select: { id: true, moves: true },
    });
    if (!game) return false;
    const last = game.moves[game.moves.length - 1];
    if (last === san) return false;
    await this.prisma.game.update({
      where: { id: game.id },
      data: { moves: { push: san } },
    });
    return true;
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
