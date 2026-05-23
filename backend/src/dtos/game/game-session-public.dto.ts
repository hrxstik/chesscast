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
  moves: string[];
  createdAt: Date;
  organization: { id: number; name: string } | null;
  players: GameSessionPlayerPublicDto[];
  canConduct: boolean;
  canWatchLive: boolean;
  canAnalyze: boolean;
  /** Есть активный WebRTC producer (трансляция с другого устройства). */
  hasLiveStream: boolean;
  /** Сохранён маппинг доски после калибровки. */
  boardCalibrated: boolean;
};
