import { Chess } from 'chess.js';

/** Если лучший ход в PV сразу матует — вернуть mateWhite (±N), иначе null. */
export function inferMateWhiteFromPv(fen: string, pvUci: string): number | null {
  const uci = pvUci.trim().split(/\s+/)[0];
  if (!uci || uci.length < 4) return null;
  try {
    const before = new Chess(fen);
    const stm = before.turn();
    const chess = new Chess(fen);
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined,
    });
    if (!chess.isCheckmate()) return null;
    return stm === 'w' ? 1 : -1;
  } catch {
    return null;
  }
}

/** UCI-линия из Stockfish → SAN для отображения (например Qxf7# вместо h5f7). */
export function formatPvLineUciToSan(fen: string, pvUci: string, maxMoves = 8): string {
  const tokens = pvUci.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  try {
    const chess = new Chess(fen);
    const parts: string[] = [];
    for (const uci of tokens.slice(0, maxMoves)) {
      if (uci.length < 4) break;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const played = chess.move({
        from,
        to,
        promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
      if (!played) break;
      parts.push(played.san);
    }
    return parts.join(' ');
  } catch {
    return pvUci;
  }
}
