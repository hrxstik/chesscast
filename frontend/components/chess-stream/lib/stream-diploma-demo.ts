import { Chess } from 'chess.js';

/** Короткая демо-партия для скриншотов (итальянская, ~10 полуходов). */
export const DIPLOMA_DEMO_SANS = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'c3',
  'Nf6',
  'd4',
  'exd4',
  'cxd4',
  'Bb4+',
  'Bd2',
  'Bxd2+',
  'Nbxd2',
  'd5',
  'exd5',
  'Nxd5',
  'O-O',
] as const;

export function fenAfterDemoMoves(count: number): string {
  const game = new Chess();
  for (let i = 0; i < count && i < DIPLOMA_DEMO_SANS.length; i++) {
    game.move(DIPLOMA_DEMO_SANS[i]);
  }
  return game.fen();
}

export function demoMovesSlice(count: number): { san: string }[] {
  return DIPLOMA_DEMO_SANS.slice(0, count).map((san) => ({ san }));
}

export function formatDemoMoveHint(index: number): string | null {
  if (index < 0 || index >= DIPLOMA_DEMO_SANS.length) return null;
  const n = Math.floor(index / 2) + 1;
  const side = index % 2 === 0 ? 'белые' : 'чёрные';
  return `${n}. ${DIPLOMA_DEMO_SANS[index]} (${side})`;
}
