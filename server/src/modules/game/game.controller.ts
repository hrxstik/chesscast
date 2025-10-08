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
} from '@nestjs/common';
import { GameService } from './game.service';
import { Game, Prisma } from '@prisma/client';
import { CreateGameDto } from 'src/dtos/create/create-game.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get(':token')
  async getGameByToken(@Param('token') token: string): Promise<Game> {
    return this.gameService.getByToken(token);
  }

  @Get('user/:userId')
  async getGamesByUserId(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const skipNum = skip ? parseInt(skip) : 0;
    const takeNum = take ? parseInt(take) : 10;
    return this.gameService.getPaginatedByUserId(userId, skipNum, takeNum);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createGame(@Body() createGameDto: CreateGameDto): Promise<Game> {
    return this.gameService.createGame(createGameDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteGameById(@Param('id', ParseIntPipe) id: number): Promise<Game> {
    return this.gameService.deleteById(id);
  }
}
