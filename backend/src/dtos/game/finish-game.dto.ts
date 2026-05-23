import { IsEnum } from 'class-validator';
import { GameResult } from '@prisma/client';

const FINISH_RESULTS = [
  'WHITE_WIN',
  'BLACK_WIN',
  'DRAW',
  'STALEMATE',
  'WHITE_RESIGN',
  'BLACK_RESIGN',
  'WHITE_TIME_OUT',
  'BLACK_TIME_OUT',
] as const;

export type FinishGameResult = (typeof FINISH_RESULTS)[number];

export class FinishGameDto {
  @IsEnum(GameResult)
  result: GameResult;
}
