import { Injectable } from '@nestjs/common';
import { Game, Prisma } from '@prisma/client';
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
        users: {
          some: {
            userId,
          },
        },
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
  ): Promise<Game[]> {
    return this.prisma.game.findMany({
      where: {
        users: {
          some: { userId },
        },
        deletedAt: null,
        ...(cursorId != null ? { id: { lt: cursorId } } : {}),
      },
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
