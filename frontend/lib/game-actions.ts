import type { GameListItem } from '@/lib/api/types';

export type GameUiActions = {
  showConduct: boolean;
  showWatchLive: boolean;
  showAnalyze: boolean;
  conductHref: string;
  watchHref: string;
  analyzeHref: string;
};

export function getGameUiActions(game: GameListItem): GameUiActions {
  const token = game.token;
  const watchHref = `/game/watch/${token}`;
  const analyzeHref = `/game/${token}`;

  return {
    showConduct: game.canConduct,
    showWatchLive: game.canWatchLive,
    showAnalyze: game.canAnalyze,
    conductHref: watchHref,
    watchHref: watchHref,
    analyzeHref,
  };
}
