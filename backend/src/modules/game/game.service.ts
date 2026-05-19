import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GameRepository, type GameWithAccess } from './game.repository';
import {
  Game,
  GameResult,
  GameStatus,
  GameVisibility,
  Prisma,
} from '@prisma/client';
import { CreateGameDto } from 'src/dtos/create/create-game.dto';
import { OrganizationService } from '../organization/organization.service';
import { GameSessionPublicDto } from 'src/dtos/game/game-session-public.dto';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly organizationService: OrganizationService,
    private readonly prisma: PrismaService,
  ) {}

  async getByToken(token: string, viewerUserId?: number): Promise<GameWithAccess> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      throw new NotFoundException(`Game with token ${token} not found`);
    }
    if (!(await this.canUserViewGame(game, viewerUserId))) {
      throw new ForbiddenException('Нет доступа к этой партии');
    }
    return game;
  }

  /** Данные партии для UI (без паролей участников). */
  async getSessionPublicByToken(
    token: string,
    viewerUserId?: number,
  ): Promise<GameSessionPublicDto> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      throw new NotFoundException(`Game with token ${token} not found`);
    }
    if (!(await this.canUserViewGame(game, viewerUserId))) {
      throw new ForbiddenException('Нет доступа к этой партии');
    }
    return {
      id: game.id,
      token: game.token,
      mode: game.mode,
      result: game.result,
      status: game.status,
      visibility: game.visibility,
      initialPosition: game.initialPosition,
      moves: game.moves,
      createdAt: game.createdAt,
      organization: game.organization
        ? { id: game.organization.id, name: game.organization.name }
        : null,
      players: game.users.map((u) => ({
        userId: u.user.id,
        name: u.user.name,
        avatar: u.user.avatar,
        color: u.color,
      })),
    };
  }

  private async canUserViewGame(
    game: GameWithAccess,
    viewerUserId?: number,
  ): Promise<boolean> {
    if (game.visibility === GameVisibility.PUBLIC) {
      return true;
    }
    if (viewerUserId == null) {
      return false;
    }
    if (game.creatorId === viewerUserId) {
      return true;
    }
    return game.users.some((u) => u.userId === viewerUserId);
  }

  async getPaginatedByUserId(
    userId: number,
    skip?: number,
    take?: number,
  ): Promise<Game[]> {
    try {
      return await this.gameRepository.findManyByUserIdPaginated(
        userId,
        skip,
        take,
      );
    } catch {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
  }

  async getMyGamesCursor(
    userId: number,
    limit: number,
    cursorId?: number,
    filters?: {
      status?: string;
      mode?: string;
      organizationId?: number;
      result?: string;
      token?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{ items: Game[]; nextCursor: number | null }> {
    const take = Math.min(Math.max(limit, 1), 50);
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(filters.to) : undefined;
    const items = await this.gameRepository.findManyByUserIdCursor(
      userId,
      take + 1,
      cursorId,
      {
        status: filters?.status,
        mode: filters?.mode,
        organizationId: filters?.organizationId,
        result: filters?.result,
        token: filters?.token,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      },
    );
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;
    return { items: page, nextCursor };
  }

  async createGame(data: CreateGameDto, creatorId: number): Promise<Game> {
    const activeSubscription =
      await this.organizationService.getActiveSubscriptionWithPlan(creatorId);
    if (!activeSubscription) {
      throw new ForbiddenException('Нужна активная подписка для создания игры');
    }
    if (!activeSubscription.plan.canStream) {
      throw new ForbiddenException('Текущий тариф не позволяет запускать стримы');
    }

    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
    const gamesThisPeriod = await this.prisma.game.count({
      where: {
        creatorId,
        deletedAt: null,
        createdAt: { gte: periodStart },
      },
    });
    if (gamesThisPeriod >= activeSubscription.plan.maxGamesPerPeriod) {
      throw new ForbiddenException('Достигнут лимит игр для текущего тарифа');
    }

    if (data.organizationId) {
      const orgExists = await this.organizationService.findById(
        data.organizationId,
      );
      if (!orgExists) {
        throw new NotFoundException(
          `Organization with id ${data.organizationId} not found`,
        );
      }

      const member = await this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: creatorId,
            organizationId: data.organizationId,
          },
        },
      });
      if (!member) {
        throw new ForbiddenException('Создавать игру в организации может только её участник');
      }

      const activeOrg = await this.organizationService.isOrganizationActive(
        data.organizationId,
      );
      if (!activeOrg) {
        throw new ForbiddenException(
          'Организация неактивна: у администратора нет активной подписки',
        );
      }
    }

    const token = crypto.randomUUID();

    const createData: Prisma.GameCreateInput = {
      mode: data.mode,
      token,
      visibility: data.visibility ?? GameVisibility.PRIVATE,
      creator: { connect: { id: creatorId } },
      organization: data.organizationId
        ? { connect: { id: data.organizationId } }
        : undefined,
      initialPosition: 'startpos',
      status: GameStatus.PENDING,
      result: GameResult.CANCELLED,
    };

    try {
      return await this.gameRepository.create(createData);
    } catch (error) {
      throw new InternalServerErrorException('Error creating game');
    }
  }

  async deleteById(id: number, requesterId: number): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game || game.deletedAt) {
      throw new NotFoundException(`Game with id ${id} not found`);
    }
    if (game.creatorId === requesterId) {
      return this.gameRepository.deleteById(id);
    }
    if (game.organizationId != null) {
      const org = await this.prisma.organization.findUnique({
        where: { id: game.organizationId },
        select: { ownerUserId: true },
      });
      if (org?.ownerUserId === requesterId) {
        return this.gameRepository.deleteById(id);
      }
    }
    throw new ForbiddenException('Удалить партию может только создатель или владелец организации');
  }
}
