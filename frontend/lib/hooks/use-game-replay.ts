'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';

function buildFenTimeline(moves: string[], initialPosition: string): string[] {
  try {
    const chess =
      initialPosition && initialPosition !== 'startpos'
        ? new Chess(initialPosition)
        : new Chess();
    const fens = [chess.fen()];
    for (const san of moves) {
      const played = chess.move(san, { strict: false });
      if (!played) break;
      fens.push(chess.fen());
    }
    return fens;
  } catch {
    return [new Chess().fen()];
  }
}

export function useGameReplay(moves: string[], initialPosition = 'startpos') {
  const fens = useMemo(
    () => buildFenTimeline(moves, initialPosition),
    [moves, initialPosition],
  );
  const maxPly = Math.max(0, fens.length - 1);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    setPly(maxPly);
  }, [maxPly, moves]);

  const clampedPly = Math.min(Math.max(0, ply), maxPly);
  const currentFen = fens[clampedPly] ?? fens[0];

  const goStart = useCallback(() => setPly(0), []);
  const goEnd = useCallback(() => setPly(maxPly), [maxPly]);
  const goPrev = useCallback(() => setPly((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setPly((p) => Math.min(maxPly, p + 1)), [maxPly]);

  return {
    currentFen,
    ply: clampedPly,
    maxPly,
    canPrev: clampedPly > 0,
    canNext: clampedPly < maxPly,
    goStart,
    goEnd,
    goPrev,
    goNext,
    /** Синхронизировать ply с полной линией ходов (после загрузки с API). */
    syncToEnd: useCallback(() => setPly(maxPly), [maxPly]),
  };
}
