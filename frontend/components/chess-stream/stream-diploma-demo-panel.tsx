'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import {
  DIPLOMA_DEMO_SANS,
  demoMovesSlice,
  fenAfterDemoMoves,
  formatDemoMoveHint,
} from '@/components/chess-stream/lib/stream-diploma-demo';

type Props = {
  disabled?: boolean;
  onApply: (payload: {
    moves: { san: string }[];
    fen: string;
    gameStarted: boolean;
  }) => void;
};

export function StreamDiplomaDemoPanel({ disabled, onApply }: Props) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const reset = useCallback(() => {
    setActive(false);
    setStep(0);
    onApply({
      moves: [],
      fen: fenAfterDemoMoves(0),
      gameStarted: false,
    });
  }, [onApply]);

  const start = useCallback(() => {
    setActive(true);
    setStep(0);
    onApply({
      moves: [],
      fen: fenAfterDemoMoves(0),
      gameStarted: true,
    });
  }, [onApply]);

  const next = useCallback(() => {
    if (step >= DIPLOMA_DEMO_SANS.length) return;
    const nextStep = step + 1;
    setStep(nextStep);
    onApply({
      moves: demoMovesSlice(nextStep),
      fen: fenAfterDemoMoves(nextStep),
      gameStarted: true,
    });
  }, [step, onApply]);

  const showAll = useCallback(() => {
    const n = DIPLOMA_DEMO_SANS.length;
    setActive(true);
    setStep(n);
    onApply({
      moves: demoMovesSlice(n),
      fen: fenAfterDemoMoves(n),
      gameStarted: true,
    });
  }, [onApply]);

  const hint = formatDemoMoveHint(step);

  return (
    <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-3 space-y-2">
      <Text className="!text-sm font-medium !mb-0">
        Демо для диплома (скриншоты)
      </Text>
      <Text className="!text-xs text-muted-foreground !mb-0">
        Расставьте фигуры на реальной доске по подсказке, сделайте скрин с LIVE и
        списком ходов. CV не используется.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || active}
          onClick={start}
        >
          Начать демо
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || !active || step >= DIPLOMA_DEMO_SANS.length}
          onClick={next}
        >
          Следующий ход ({step}/{DIPLOMA_DEMO_SANS.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={showAll}
        >
          Вся линия сразу
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={reset}
        >
          Сбросить
        </Button>
      </div>
      {active && hint ? (
        <Text className="!text-xs font-mono text-foreground !mb-0">
          На доске: {hint}
        </Text>
      ) : null}
      {active && step >= DIPLOMA_DEMO_SANS.length ? (
        <Text className="!text-xs text-muted-foreground !mb-0">
          Линия сыграна — можно снимать финальный кадр.
        </Text>
      ) : null}
    </div>
  );
}
