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

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly organizationService: OrganizationService,
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
    if (game.users.some((u) => u.userId === viewerUserId)) {
      return true;
    }
    if (game.organizationId != null) {
      return this.organizationService.isUserMember(
        viewerUserId,
        game.organizationId,
      );
    }
    return false;
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
  ): Promise<{ items: Game[]; nextCursor: number | null }> {
    const take = Math.min(Math.max(limit, 1), 50);
    const items = await this.gameRepository.findManyByUserIdCursor(
      userId,
      take + 1,
      cursorId,
    );
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;
    return { items: page, nextCursor };
  }

  async createGame(data: CreateGameDto, creatorId: number): Promise<Game> {
    if (data.organizationId) {
      const orgExists = await this.organizationService.findById(
        data.organizationId,
      );
      if (!orgExists) {
        throw new NotFoundException(
          `Organization with id ${data.organizationId} not found`,
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

  async deleteById(id: number): Promise<Game> {
    try {
      await this.gameRepository.findById(id);
    } catch {
      throw new NotFoundException(`Game with id ${id} not found`);
    }
    try {
      return this.gameRepository.deleteById(id);
    } catch {
      throw new InternalServerErrorException('Error deleting game');
    }
  }
}
