'use client';

import type { ReactNode } from 'react';

type Props = {
  videoColumn: ReactNode;
  boardColumn: ReactNode;
  sidebar: ReactNode;
  /** Дублируется: под видео на xl и сразу после доски на мобилке */
  renderStreamerControls: () => ReactNode;
};

/**
 * Сетка стрима: на xl — видео | доска | сайдбар; на мобилке — видео, доска, управление, сайдбар.
 */
export function ChessStreamGrid({
  videoColumn,
  boardColumn,
  sidebar,
  renderStreamerControls,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
      <div className="order-1 flex flex-col gap-2 xl:col-span-3">
        {videoColumn}
        <div className="hidden xl:block">{renderStreamerControls()}</div>
      </div>

      <div className="order-2 flex flex-col items-center gap-2 xl:col-span-5">{boardColumn}</div>

      <div className="order-3 xl:hidden">{renderStreamerControls()}</div>

      <aside className="order-4 flex min-h-0 flex-col gap-3 xl:order-3 xl:col-span-4">{sidebar}</aside>
    </div>
  );
}
