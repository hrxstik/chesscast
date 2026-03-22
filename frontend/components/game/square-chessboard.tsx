'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { ChessboardOptions } from 'react-chessboard';
import { cn } from '@/lib/utils';

type Props = {
  options: ChessboardOptions;
  className?: string;
  /** Макс. размер стороны доски (px) */
  maxBoardPx?: number;
};

/** Квадратная доска: ширина = высоте контейнера, без «рваных» отступов от boardStyle. */
export function SquareChessboard({ options, className, maxBoardPx = 560 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(320);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const side = Math.min(w, h, maxBoardPx);
    const next = Math.max(200, Math.floor(side));
    setBoardWidth((prev) => (Math.abs(prev - next) > 2 ? next : prev));
  }, [maxBoardPx]);

  useLayoutEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={wrapRef}
      className={cn('mx-auto aspect-square w-full max-w-[min(100%,560px)]', className)}
      style={{ maxWidth: maxBoardPx }}>
      <div
        className="flex items-center justify-center overflow-hidden rounded-lg"
        style={{ width: boardWidth, height: boardWidth, maxWidth: '100%' }}>
        <Chessboard options={options} />
      </div>
    </div>
  );
}
