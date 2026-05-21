import { Color, GameResult, GameStatus, GameVisibility } from '@prisma/client';

export type GameSessionPlayerPublicDto = {
  userId: number;
  name: string;
  avatar: string;
  color: Color;
};

export type GameSessionPublicDto = {
  id: number;
  token: string;
  result: GameResult;
  status: GameStatus;
  visibility: GameVisibility;
  initialPosition: string;
  moves: string[];
  createdAt: Date;
  organization: { id: number; name: string } | null;
  players: GameSessionPlayerPublicDto[];
  canConduct: boolean;
  canWatchLive: boolean;
  canAnalyze: boolean;
};
