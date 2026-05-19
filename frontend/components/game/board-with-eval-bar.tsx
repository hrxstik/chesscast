'use client';

import type { ChessboardOptions } from 'react-chessboard';
import { SquareChessboard } from '@/components/game/square-chessboard';
import { EvalBar } from '@/components/game/eval-bar';
import { cn } from '@/lib/utils';

type Props = {
  options: ChessboardOptions;
  cpWhite: number;
  mateWhite?: number | null;
  className?: string;
  maxBoardPx?: number;
};

/** Доска + вертикальная шкала оценки (chess.com). */
export function BoardWithEvalBar({
  options,
  cpWhite,
  mateWhite,
  className,
  maxBoardPx = 560,
}: Props) {
  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[min(100%,578px)] grid-cols-[22px_minmax(0,1fr)] gap-1.5',
        className,
      )}>
      <EvalBar cpWhite={cpWhite} mateWhite={mateWhite} className="h-full min-h-0 w-[22px]" />
      <SquareChessboard options={options} maxBoardPx={maxBoardPx} />
    </div>
  );
}
