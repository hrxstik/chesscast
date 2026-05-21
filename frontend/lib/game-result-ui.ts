/** Исход стороны для бейджа у «короля» (как на chess.com). */
export type SideOutcome = 'win' | 'loss' | 'draw' | null;

const DRAW_RESULTS = new Set(['DRAW', 'STALEMATE']);

const WHITE_WINS = new Set([
  'WHITE_WIN',
  'BLACK_LOSE',
  'BLACK_RESIGN',
  'BLACK_TIME_OUT',
]);

const BLACK_WINS = new Set([
  'BLACK_WIN',
  'WHITE_LOSE',
  'WHITE_RESIGN',
  'WHITE_TIME_OUT',
]);

export function getSideOutcome(
  result: string | undefined | null,
  color: 'WHITE' | 'BLACK',
): SideOutcome {
  if (!result || result === 'CANCELLED') return null;
  if (DRAW_RESULTS.has(result)) return 'draw';
  if (color === 'WHITE') {
    if (WHITE_WINS.has(result)) return 'win';
    if (BLACK_WINS.has(result)) return 'loss';
  } else {
    if (BLACK_WINS.has(result)) return 'win';
    if (WHITE_WINS.has(result)) return 'loss';
  }
  return null;
}

export function outcomeBadgeText(outcome: SideOutcome): string | null {
  if (outcome === 'win') return '1';
  if (outcome === 'loss') return '0';
  if (outcome === 'draw') return '½';
  return null;
}
