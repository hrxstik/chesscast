import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GameRepository } from './game.repository';
import { Game, GameResult, GameStatus, Prisma } from '@prisma/client';
import { CreateGameDto } from 'src/dtos/create/create-game.dto';
import { OrganizationService } from '../organization/organization.service';
import crypto from 'crypto';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly organizationService: OrganizationService,
  ) {}

  async getByToken(token: string): Promise<Game> {
    const game = await this.gameRepository.findByToken(token);
    if (!game)
      throw new NotFoundException(`Game with token ${token} not found`);
    return game;
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

  async createGame(data: CreateGameDto): Promise<Game> {
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
