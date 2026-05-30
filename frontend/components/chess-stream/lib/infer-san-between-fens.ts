import { Chess } from 'chess.js';

function placement(fen: string): string {
  return fen.trim().split(/\s+/)[0] ?? '';
}

/**
 * Один легальный ход между двумя FEN (точное совпадение расстановки после хода).
 */
export function inferSanMoveBetweenFens(
  prevFen: string,
  nextFen: string,
): string | null {
  const prev = placement(prevFen);
  const next = placement(nextFen);
  if (!prev || !next || prev === next) {
    return null;
  }

  for (const stm of ['w', 'b'] as const) {
    try {
      const base = `${prev} ${stm} - - 0 1`;
      const game = new Chess(base);
      for (const uci of game.moves()) {
        const trial = new Chess(base);
        const moved = trial.move(uci);
        if (!moved) continue;
        if (placement(trial.fen()) === next) {
          return moved.san;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}
