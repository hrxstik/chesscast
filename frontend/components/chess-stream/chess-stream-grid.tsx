'use client';

import type { ReactNode } from 'react';

type Props = {
  videoColumn: ReactNode;
  boardColumn: ReactNode;
  sidebar: ReactNode;
  renderStreamerControls: () => ReactNode;
};

/**
 * Сетка стрима: на xl — видео | доска | сайдбар; управление под доской.
 */
export function ChessStreamGrid({
  videoColumn,
  boardColumn,
  sidebar,
  renderStreamerControls,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
      <div className="order-1 xl:col-span-3">{videoColumn}</div>

      <div className="order-2 flex w-full flex-col items-center gap-3 xl:col-span-5">
        {boardColumn}
        <div className="w-full max-w-[min(100%,560px)]">{renderStreamerControls()}</div>
      </div>

      <aside className="order-3 flex min-h-0 flex-col gap-3 xl:order-3 xl:col-span-4">
        {sidebar}
      </aside>
    </div>
  );
}
