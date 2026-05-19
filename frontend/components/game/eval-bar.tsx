'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  /** Оценка в сантипешках с точки зрения белых (+ = белые лучше). */
  cpWhite: number;
  /** Мат в полуходах для белых (+) или чёрных (−), если движок дал mate. */
  mateWhite?: number | null;
  className?: string;
  /** Высота полоски (px), обычно = сторона доски. */
  height?: number;
};

/** Доля белой части полоски (0–100), как на chess.com. */
export function cpWhiteToBarPercent(cpWhite: number, mateWhite?: number | null): number {
  if (mateWhite != null && mateWhite !== 0) {
    if (mateWhite > 0) return 99.5;
    return 0.5;
  }
  const cp = Math.max(-1500, Math.min(1500, cpWhite));
  return 50 + 50 * (2 / (1 + Math.exp(-0.0035 * cp)) - 1);
}

/**
 * Вертикальная шкала оценки: белые снизу, чёрные сверху.
 * Плавное движение через CSS transition.
 */
export function EvalBar({ cpWhite, mateWhite, className, height }: Props) {
  const target = cpWhiteToBarPercent(cpWhite, mateWhite);
  const [whitePercent, setWhitePercent] = useState(50);

  useEffect(() => {
    setWhitePercent(target);
  }, [target]);

  const label =
    mateWhite != null && mateWhite !== 0
      ? `M${Math.abs(mateWhite)}`
      : cpWhite >= 0
        ? `+${(cpWhite / 100).toFixed(1)}`
        : `${(cpWhite / 100).toFixed(1)}`;

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-sm border border-border/60 bg-zinc-900 shadow-inner',
        className,
      )}
      style={{
        width: 22,
        ...(height != null ? { height } : { alignSelf: 'stretch', minHeight: 200 }),
      }}
      title={`Оценка: ${label}`}
      aria-label={`Оценка позиции: ${label}`}>
      <div
        className="absolute inset-x-0 bottom-0 bg-zinc-100 transition-[height] duration-500 ease-out"
        style={{ height: `${whitePercent}%` }}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-1 z-10 text-center text-[9px] font-semibold leading-none text-zinc-900 mix-blend-difference">
        {Math.abs(target - 50) > 8 || mateWhite ? label : ''}
      </span>
    </div>
  );
}
