'use client';

import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SideOutcome } from '@/lib/game-result-ui';

/** Сайдбар: полупрозрачные бейджи. */
export const OUTCOME_SIDEBAR_STYLES = {
  win: {
    bg: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  },
  loss: {
    bg: 'bg-red-600/15 text-red-700 dark:text-red-400',
  },
  draw: {
    bg: 'bg-muted text-muted-foreground',
  },
} as const;

/** Доска: непрозрачные, белая иконка/текст. */
export const OUTCOME_BOARD_STYLES = {
  win: {
    bg: 'bg-emerald-600 text-white ring-1 ring-emerald-700/40',
  },
  loss: {
    bg: 'bg-red-600 text-white ring-1 ring-red-700/40',
  },
  draw: {
    bg: 'bg-zinc-500 text-white ring-1 ring-zinc-600/40',
  },
} as const;

const SIDEBAR_BADGE =
  'inline-flex shrink-0 items-center justify-center rounded-full font-bold';

function sidebarClasses(outcome: SideOutcome, drawWide = false) {
  const s = OUTCOME_SIDEBAR_STYLES[outcome!];
  if (outcome === 'draw') {
    return cn(SIDEBAR_BADGE, 'min-w-7 px-1.5 tabular-nums', drawWide && 'size-7', s.bg);
  }
  return cn(SIDEBAR_BADGE, 'size-7', s.bg);
}

const BOARD_BADGE =
  'pointer-events-none absolute right-px top-px z-30 inline-flex size-[1.05rem] items-center justify-center rounded-full font-bold leading-none shadow-sm sm:size-[1.15rem]';

function boardClasses(outcome: SideOutcome) {
  return cn(BOARD_BADGE, OUTCOME_BOARD_STYLES[outcome!].bg);
}

/** Маркер в карточке участника (левая панель). */
export function OutcomeSidebarBadge({ outcome }: { outcome: SideOutcome }) {
  if (!outcome) return null;

  if (outcome === 'draw') {
    return (
      <span className={sidebarClasses('draw', true)} title="Ничья">
        ½
      </span>
    );
  }

  if (outcome === 'win') {
    return (
      <span className={sidebarClasses('win')} title="Победа">
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  }

  return (
    <span className={sidebarClasses('loss')} title="Поражение">
      #
    </span>
  );
}

/** Маркер на клетке короля — правый верхний угол клетки. */
export function OutcomeKingMarker({
  outcome,
  className,
}: {
  outcome: SideOutcome;
  className?: string;
}) {
  if (!outcome) return null;

  if (outcome === 'draw') {
    return (
      <span className={cn(boardClasses('draw'), 'text-[9px] sm:text-[10px]', className)} title="Ничья">
        ½
      </span>
    );
  }

  if (outcome === 'win') {
    return (
      <span className={cn(boardClasses('win'), className)} title="Победа">
        <Crown className="size-[0.55rem] sm:size-[0.6rem]" aria-hidden strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span className={cn(boardClasses('loss'), 'text-[9px] sm:text-[10px]', className)} title="Поражение">
      #
    </span>
  );
}
