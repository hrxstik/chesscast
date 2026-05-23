'use client';

import type { ChessboardOptions } from 'react-chessboard';
import { Chess } from 'chess.js';
import { OutcomeKingMarker } from '@/lib/game/outcome-ui';
import { getSideOutcome } from '@/lib/game-result-ui';

function findKingSquare(fen: string, color: 'w' | 'b'): string | null {
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank]?.[file];
        if (piece?.type === 'k' && piece.color === color) {
          return `${String.fromCharCode(97 + file)}${8 - rank}`;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function buildFenFromMoves(
  moves: string[],
  initialPosition = 'startpos',
): string {
  try {
    const chess =
      initialPosition && initialPosition !== 'startpos'
        ? new Chess(initialPosition)
        : new Chess();
    for (const san of moves) {
      const played = chess.move(san, { strict: false });
      if (!played) break;
    }
    return chess.fen();
  } catch {
    return new Chess().fen();
  }
}

/** Маркеры исхода на королях; только при showMarkers (финальный ход партии). */
export function withKingOutcomeMarkers(
  options: ChessboardOptions,
  gameResult: string | null | undefined,
  fen: string,
  showMarkers: boolean,
): ChessboardOptions {
  if (!showMarkers || !gameResult || gameResult === 'CANCELLED') return options;

  const whiteKing = findKingSquare(fen, 'w');
  const blackKing = findKingSquare(fen, 'b');
  const whiteOutcome = getSideOutcome(gameResult, 'WHITE');
  const blackOutcome = getSideOutcome(gameResult, 'BLACK');
  const isDraw = whiteOutcome === 'draw' && blackOutcome === 'draw';
  const prevRenderer = options.squareRenderer;

  return {
    ...options,
    squareRenderer: ({ piece, square, children }) => {
      const base = prevRenderer
        ? prevRenderer({ piece, square, children })
        : children;

      let marker = null;
      if (isDraw) {
        if (square === whiteKing || square === blackKing) {
          marker = <OutcomeKingMarker outcome="draw" />;
        }
      } else {
        if (square === whiteKing && whiteOutcome) {
          marker = <OutcomeKingMarker outcome={whiteOutcome} />;
        } else if (square === blackKing && blackOutcome) {
          marker = <OutcomeKingMarker outcome={blackOutcome} />;
        }
      }

      if (!marker) return <>{base}</>;

      return (
        <div className="relative h-full w-full overflow-visible">
          {base}
          {marker}
        </div>
      );
    },
  };
}
