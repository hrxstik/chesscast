/**
 * board_state: 8×8, ID фигур как в stream_processor.py → FEN плоскости + хвост ` w - - 0 1`.
 */
export function boardStateToFen(boardState: number[][]): string {
  const pieceMap: Record<number, string> = {
    0: 'P',
    1: 'R',
    2: 'B',
    3: 'N',
    4: 'K',
    5: 'Q',
    6: 'p',
    7: 'r',
    8: 'b',
    9: 'k',
    10: 'q',
    11: 'n',
  };

  let fen = '';
  for (let row = 0; row < 8; row++) {
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      const pieceId = boardState[row][col];
      if (pieceId === -1) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fen += emptyCount.toString();
          emptyCount = 0;
        }
        const pieceSymbol = pieceMap[pieceId];
        if (!pieceSymbol) {
          emptyCount++;
          continue;
        }
        const isPawn = pieceId === 0 || pieceId === 6;
        if (isPawn && (row === 0 || row === 7)) {
          emptyCount++;
          continue;
        }
        fen += pieceSymbol;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount.toString();
    }
    if (row < 7) {
      fen += '/';
    }
  }

  const hasWhiteKing = boardState.some((row) => row.some((cell) => cell === 4));
  const hasBlackKing = boardState.some((row) => row.some((cell) => cell === 9));
  if (!hasWhiteKing || !hasBlackKing || fen === '8/8/8/8/8/8/8/8') {
    return '8/8/8/8/8/8/8/4K2k w - - 0 1';
  }
  fen += ' w - - 0 1';
  if (!hasWhiteKing || !hasBlackKing) {
    return '8/8/8/8/8/8/8/4K2k w - - 0 1';
  }
  return fen;
}
