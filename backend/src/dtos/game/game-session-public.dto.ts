import { Color, GameMode, GameResult, GameStatus, GameVisibility } from '@prisma/client';

export type GameSessionPlayerPublicDto = {
  userId: number;
  name: string;
  avatar: string;
  color: Color;
};

export type GameSessionPublicDto = {
  id: number;
  token: string;
  mode: GameMode;
  result: GameResult;
  status: GameStatus;
  visibility: GameVisibility;
  initialPosition: string;
  moves: string[];
  createdAt: Date;
  organization: { id: number; name: string } | null;
  players: GameSessionPlayerPublicDto[];
};
