import { Chess } from 'chess.js';

/** Сравниваем только расстановку (без счётчиков ходов). */
function placement(fen: string): string {
  return fen.trim().split(/\s+/)[0] ?? '';
}

/**
 * Один легальный ход между двумя FEN (после стабилизации на сервере).
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

  try {
    const game = new Chess(prevFen);
    for (const uci of game.moves()) {
      const trial = new Chess(prevFen);
      const moved = trial.move(uci);
      if (!moved) continue;
      if (placement(trial.fen()) === next) {
        return moved.san;
      }
    }
  } catch {
    return null;
  }
  return null;
}
