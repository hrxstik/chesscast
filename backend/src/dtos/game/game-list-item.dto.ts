import { GameResult, GameStatus, GameVisibility } from '@prisma/client';

export type GameListItemDto = {
  id: number;
  token: string;
  status: GameStatus;
  result: GameResult;
  visibility: GameVisibility;
  organizationId: number | null;
  creatorId: number | null;
  createdAt: Date;
  organization?: { id: number; name: string } | null;
  canConduct: boolean;
  canWatchLive: boolean;
  canAnalyze: boolean;
};
