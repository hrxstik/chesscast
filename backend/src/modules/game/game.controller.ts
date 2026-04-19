import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Game } from '@prisma/client';
import { GameService } from './game.service';
import type { GameWithAccess } from './game.repository';
import { CreateGameDto } from 'src/dtos/create/create-game.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import {
  OptionalJwtAuthGuard,
  type AuthRequestUser,
} from 'src/guards/optional-jwt-auth.guard';
import { Request } from 'express';

/** После JwtAuthGuard — id из payload.sub. */
type RequestUser = { id: number; email?: string };

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /** Must be before :token — otherwise "user" is parsed as token. */
  @UseGuards(JwtAuthGuard)
  @Get('user/:userId')
  async getGamesByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Req() req: Request & { user: RequestUser },
  ) {
    if (req.user.id !== userId) {
      throw new ForbiddenException('Можно запрашивать только свои партии');
    }
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 10;
    return this.gameService.getPaginatedByUserId(userId, skipNum, takeNum);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyGamesCursor(
    @Req() req: Request & { user: RequestUser },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('mode') mode?: string,
    @Query('organizationId') organizationId?: string,
    @Query('result') result?: string,
    @Query('token') token?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const cursorId =
      cursor !== undefined && cursor !== ''
        ? parseInt(cursor, 10)
        : undefined;
    if (cursorId !== undefined && Number.isNaN(cursorId)) {
      return { items: [], nextCursor: null };
    }
    const orgId =
      organizationId !== undefined && organizationId !== ''
        ? parseInt(organizationId, 10)
        : undefined;
    return this.gameService.getMyGamesCursor(userId, limitNum, cursorId, {
      status,
      mode,
      organizationId: orgId != null && !Number.isNaN(orgId) ? orgId : undefined,
      result,
      token,
      from,
      to,
    });
  }

  /** Публичное представление партии (игроки без чувствительных полей). До динамического :token. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('session/:token')
  async getGameSessionPublic(
    @Param('token') token: string,
    @Req() req: Request & { user?: AuthRequestUser },
  ) {
    return this.gameService.getSessionPublicByToken(token, req.user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':token')
  async getGameByToken(
    @Param('token') token: string,
    @Req() req: Request & { user?: AuthRequestUser },
  ): Promise<GameWithAccess> {
    return this.gameService.getByToken(token, req.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createGame(
    @Body() createGameDto: CreateGameDto,
    @Req() req: Request & { user: RequestUser },
  ): Promise<Game> {
    return this.gameService.createGame(createGameDto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteGameById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: RequestUser },
  ): Promise<Game> {
    return this.gameService.deleteById(id, req.user.id);
  }
}
