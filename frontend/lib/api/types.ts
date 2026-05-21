export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type AuthUserDto = {
  id: number;
  name: string;
  email: string;
  platformRole?: 'USER' | 'SUPERADMIN';
  avatar?: string;
};

export type LoginResponse = {
  user: AuthUserDto;
};

export type GameListItem = {
  id: number;
  token: string;
  status: string;
  result: string;
  visibility: string;
  organizationId: number | null;
  creatorId: number | null;
  createdAt: string;
  organization?: { id: number; name: string } | null;
  canConduct: boolean;
  canWatchLive: boolean;
  canAnalyze: boolean;
};

export type GamesCursorResponse = {
  items: GameListItem[];
  nextCursor: number | null;
};
