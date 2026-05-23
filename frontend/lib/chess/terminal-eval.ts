import { Chess } from 'chess.js';

/** Мат / ничья / пат — не показываем линии движка и нейтральная шкала. */
export function isTerminalChessPosition(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.isCheckmate() || chess.isStalemate() || chess.isDraw();
  } catch {
    return false;
  }
}

/** Оценка для шкалы: на матовой позиции — 0.0. */
export function barEvalForFen(fen: string): {
  cpWhite: number;
  mateWhite: number | null;
} {
  if (isTerminalChessPosition(fen)) {
    return { cpWhite: 0, mateWhite: null };
  }
  return { cpWhite: 0, mateWhite: null };
}
