import { Injectable } from '@nestjs/common';
import { Game, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async findByToken(token: string): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { token },
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
