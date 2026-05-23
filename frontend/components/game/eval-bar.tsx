"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Оценка в сантипешках с точки зрения белых (+ = белые лучше). */
  cpWhite: number;
  /** Мат в полуходах для белых (+) или чёрных (−), если движок дал mate. */
  mateWhite?: number | null;
  className?: string;
  /** Высота полоски (px), обычно = сторона доски. */
  height?: number;
};

/** Доля белой части полоски (0–100), в духе chess.com: при мате и большом перевесе — почти вся шкала. */
export function cpWhiteToBarPercent(
  cpWhite: number,
  mateWhite?: number | null,
): number {
  if (mateWhite != null && mateWhite !== 0) {
    return mateWhite > 0 ? 100 : 0;
  }
  const cp = Math.max(-2000, Math.min(2000, cpWhite));
  if (cp >= 900) return 100;
  if (cp <= -900) return 0;
  if (cp >= 550) return 98;
  if (cp <= -550) return 2;
  return 50 + 50 * (2 / (1 + Math.exp(-0.0045 * cp)) - 1);
}

/** Подпись оценки в пешках (+1.2) или мат (M3). */
export function formatEvalLabel(
  cpWhite: number,
  mateWhite?: number | null,
): string {
  if (mateWhite != null && mateWhite !== 0) {
    return `M${Math.abs(mateWhite)}`;
  }
  return cpWhite >= 0
    ? `+${(cpWhite / 100).toFixed(1)}`
    : `${(cpWhite / 100).toFixed(1)}`;
}

/**
 * Вертикальная шкала оценки: белые снизу, чёрные сверху.
 * Число в пешках — под шкалой, цветом темы (foreground).
 */
export function EvalBar({ cpWhite, mateWhite, className, height }: Props) {
  const target = cpWhiteToBarPercent(cpWhite, mateWhite);
  const [whitePercent, setWhitePercent] = useState(50);
  const label = formatEvalLabel(cpWhite, mateWhite);

  useEffect(() => {
    setWhitePercent(target);
  }, [target]);

  return (
    <div
      className={cn("flex shrink-0 flex-col items-center gap-1", className)}
      style={height != null ? { height } : undefined}
    >
      <div
        className="relative w-[22px] flex-1 min-h-[200px] overflow-hidden rounded-sm border border-border/60 bg-zinc-900 shadow-inner"
        title={`Оценка: ${label}`}
        aria-label={`Оценка позиции: ${label}`}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-zinc-100 transition-[height] duration-200 ease-out"
          style={{ height: `${whitePercent}%` }}
        />
      </div>
      <span className="w-[22px] text-center text-[10px] font-semibold tabular-nums leading-none text-foreground">
        {label}
      </span>
    </div>
  );
}
