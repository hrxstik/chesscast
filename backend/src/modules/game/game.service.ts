import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { GameRepository, type GameWithAccess } from './game.repository';
import {
  Game,
  GameResult,
  GameStatus,
  GameVisibility,
  PlatformRole,
  Prisma,
} from '@prisma/client';
import { CreateGameDto } from 'src/dtos/create/create-game.dto';
import { OrganizationService } from '../organization/organization.service';
import { GameSessionPublicDto } from 'src/dtos/game/game-session-public.dto';
import { GameListItemDto } from 'src/dtos/game/game-list-item.dto';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    @Inject(forwardRef(() => OrganizationService))
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

  async getSessionPublicByToken(
    token: string,
    viewerUserId?: number,
  ): Promise<GameSessionPublicDto> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      throw new NotFoundException(`Game with token ${token} not found`);
    }
    const canView = await this.canUserViewGame(game, viewerUserId);
    const access = {
      canConduct: this.canUserConductGame(game, viewerUserId),
      canWatchLive: await this.canUserWatchLive(game, viewerUserId),
      canAnalyze: await this.canUserAnalyze(game, viewerUserId),
    };
    if (!canView) {
      throw new ForbiddenException('Нет доступа к этой партии');
    }
    return {
      id: game.id,
      token: game.token,
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
      ...access,
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
    if (game.users.some((u) => u.userId === viewerUserId)) {
      return true;
    }
    if (game.organizationId != null) {
      const member = await this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: viewerUserId,
            organizationId: game.organizationId,
          },
        },
      });
      if (member) {
        return true;
      }
    }
    return false;
  }

  canUserConductGame(
    game: Pick<Game, 'creatorId' | 'status'>,
    userId?: number,
  ): boolean {
    if (userId == null || game.creatorId !== userId) {
      return false;
    }
    return (
      game.status === GameStatus.PENDING ||
      game.status === GameStatus.IN_PROGRESS
    );
  }

  async canUserWatchLive(
    game: GameWithAccess,
    viewerUserId?: number,
  ): Promise<boolean> {
    const isLive =
      game.status === GameStatus.PENDING ||
      game.status === GameStatus.IN_PROGRESS;
    if (!isLive) {
      return false;
    }
    // Ведущий открывает /game/watch?viewer=false, не «Смотреть»
    if (viewerUserId != null && game.creatorId === viewerUserId) {
      return false;
    }
    return this.canUserViewGame(game, viewerUserId);
  }

  async canUserAnalyze(
    game: GameWithAccess,
    viewerUserId?: number,
  ): Promise<boolean> {
    if (game.status !== GameStatus.FINISHED) {
      return false;
    }
    return this.canUserViewGame(game, viewerUserId);
  }

  private async isSubscriptionExempt(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });
    return user?.platformRole === PlatformRole.SUPERADMIN;
  }

  /** Создатель партии: активная подписка с canStream (суперадмин — без проверки). */
  async assertCreatorCanStream(userId: number, token: string): Promise<void> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      throw new ForbiddenException('Партия не найдена');
    }
    if (game.creatorId !== userId) {
      throw new ForbiddenException(
        'Вести трансляцию может только создатель партии',
      );
    }
    if (game.status === GameStatus.FINISHED) {
      throw new ForbiddenException('Партия уже завершена');
    }
    if (await this.isSubscriptionExempt(userId)) {
      return;
    }
    const sub =
      await this.organizationService.getActiveSubscriptionWithPlan(userId);
    if (!sub) {
      throw new ForbiddenException(
        'Нужна активная подписка для проведения трансляции',
      );
    }
    if (!sub.plan.canStream) {
      throw new ForbiddenException(
        'Текущий тариф не позволяет запускать трансляции',
      );
    }
  }

  /** Запись подтверждённого хода в SAN (только пока партия IN_PROGRESS). */
  async appendSanMoveByToken(token: string, san: string): Promise<void> {
    const normalized = san?.trim();
    if (!normalized) return;
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt || game.status !== GameStatus.IN_PROGRESS) {
      return;
    }
    await this.gameRepository.appendSanMoveByToken(token, normalized);
  }

  async markInProgressByToken(token: string): Promise<void> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      return;
    }
    if (game.status === GameStatus.FINISHED) {
      return;
    }
    if (game.status === GameStatus.IN_PROGRESS) {
      return;
    }
    await this.prisma.game.updateMany({
      where: { token, deletedAt: null },
      data: {
        status: GameStatus.IN_PROGRESS,
        ...(game.status === GameStatus.PENDING ? { moves: [] } : {}),
      },
    });
  }

  async markFinishedByToken(token: string): Promise<void> {
    const game = await this.gameRepository.findByToken(token);
    if (!game || game.deletedAt) {
      return;
    }
    if (game.status === GameStatus.FINISHED) {
      return;
    }
    await this.prisma.game.updateMany({
      where: { token, deletedAt: null },
      data: {
        status: GameStatus.FINISHED,
        ...(game.result === GameResult.CANCELLED
          ? { result: GameResult.DRAW }
          : {}),
      },
    });
  }

  async getPaginatedByUserId(
    userId: number,
    skip?: number,
    take?: number,
    viewerUserId?: number,
  ): Promise<GameListItemDto[]> {
    try {
      const rows = await this.gameRepository.findManyByUserIdPaginated(
        userId,
        skip,
        take,
      );
      const viewer = viewerUserId ?? userId;
      return Promise.all(
        rows.map((g) => this.toListItemDto(g as GameWithAccess, viewer)),
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
      organizationId?: number;
      result?: string;
      token?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{ items: GameListItemDto[]; nextCursor: number | null }> {
    const take = Math.min(Math.max(limit, 1), 50);
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(filters.to) : undefined;
    const rows = await this.gameRepository.findManyByUserIdCursor(
      userId,
      take + 1,
      cursorId,
      {
        status: filters?.status,
        organizationId: filters?.organizationId,
        result: filters?.result,
        token: filters?.token,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      },
    );
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const items = await Promise.all(
      page.map((g) => this.toListItemDto(g as GameWithAccess, userId)),
    );
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;
    return { items, nextCursor };
  }

  async toListItemDto(
    game: GameWithAccess,
    viewerUserId: number,
  ): Promise<GameListItemDto> {
    const [canWatchLive, canAnalyze] = await Promise.all([
      this.canUserWatchLive(game, viewerUserId),
      this.canUserAnalyze(game, viewerUserId),
    ]);
    return {
      id: game.id,
      token: game.token,
      status: game.status,
      result: game.result,
      visibility: game.visibility,
      organizationId: game.organizationId,
      creatorId: game.creatorId,
      createdAt: game.createdAt,
      organization: game.organization
        ? { id: game.organization.id, name: game.organization.name }
        : null,
      canConduct: this.canUserConductGame(game, viewerUserId),
      canWatchLive,
      canAnalyze,
    };
  }

  async createGame(data: CreateGameDto, creatorId: number): Promise<Game> {
    const exempt = await this.isSubscriptionExempt(creatorId);
    if (!exempt) {
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
    } catch {
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
