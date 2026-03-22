'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  title: ReactNode;
  leftInfo: ReactNode;
  whiteLabel: ReactNode;
  board: ReactNode;
  blackLabel: ReactNode;
  movesPanel: ReactNode;
  analysisPanel: ReactNode;
  controlsPanel: ReactNode;
  className?: string;
};

/**
 * Анализ партии: инфо слева, доска по центру, справа ходы / анализ / управление.
 * На мобилке: доска → управление → инфо → ходы → анализ.
 */
export function ChessAnalysisShell({
  title,
  leftInfo,
  whiteLabel,
  board,
  blackLabel,
  movesPanel,
  analysisPanel,
  controlsPanel,
  className,
}: Props) {
  return (
    <div className={cn('flex flex-col gap-4 md:gap-6', className)}>
      <div className="shrink-0">{title}</div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <aside className="order-4 lg:order-1 lg:col-span-3">
          <Card className="h-full border-border/80">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold md:text-base">О партии</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">{leftInfo}</CardContent>
          </Card>
        </aside>

        <section className="order-1 flex flex-col items-center gap-2 lg:order-2 lg:col-span-5">
          <div className="w-full text-center text-sm font-medium">{whiteLabel}</div>
          <div className="w-full max-w-[min(100%,560px)]">{board}</div>
          <div className="w-full text-center text-sm font-medium">{blackLabel}</div>
        </section>

        <div className="order-2 lg:order-3 lg:col-span-4 lg:hidden">
          <Card className="border-border/80">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold md:text-base">Управление</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">{controlsPanel}</CardContent>
          </Card>
        </div>

        <aside className="order-5 flex flex-col gap-3 lg:order-3 lg:col-span-4">
          <Card className="border-border/80">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold md:text-base">Ходы</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[200px] overflow-y-auto p-0 px-4 pb-4">{movesPanel}</CardContent>
          </Card>
          <Card className="border-border/80">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold md:text-base">Анализ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">{analysisPanel}</CardContent>
          </Card>
          <Card className="hidden border-border/80 lg:block">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold md:text-base">Управление</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">{controlsPanel}</CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
