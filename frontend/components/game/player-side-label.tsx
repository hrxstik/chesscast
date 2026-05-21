'use client';

import { Crown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getSideOutcome,
  outcomeBadgeText,
  type SideOutcome,
} from '@/lib/game-result-ui';

type Props = {
  name: string;
  color: 'WHITE' | 'BLACK';
  gameResult?: string | null;
  className?: string;
};

function OutcomeIcon({ outcome }: { outcome: SideOutcome }) {
  const text = outcomeBadgeText(outcome);
  if (!text) return null;
  if (outcome === 'win') {
    return (
      <span
        className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
        title="Победа">
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  }
  if (outcome === 'draw') {
    return (
      <span
        className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums"
        title="Ничья">
        ½
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-muted/80 text-muted-foreground"
      title="Поражение">
      <Minus className="size-3.5" aria-hidden />
    </span>
  );
}

export function PlayerSideLabel({ name, color, gameResult, className }: Props) {
  const outcome = getSideOutcome(gameResult, color);
  const colorLabel = color === 'WHITE' ? 'белые' : 'чёрные';

  return (
    <div
      className={cn(
        'flex w-full items-center justify-center gap-2 text-sm font-medium',
        className,
      )}>
      <OutcomeIcon outcome={outcome} />
      <span className="truncate">
        {name}
        <span className="text-muted-foreground"> · {colorLabel}</span>
      </span>
      {outcome === 'win' ? (
        <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
          1
        </span>
      ) : null}
      {outcome === 'draw' ? (
        <span className="text-xs font-bold tabular-nums text-muted-foreground">½</span>
      ) : null}
    </div>
  );
}
