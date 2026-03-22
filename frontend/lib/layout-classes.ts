import { cn } from '@/lib/utils';

/**
 * Максимальная ширина контентной колонки по брейкпоинтам (см. docs/frontend-layout.md).
 * < md: на всю ширину вьюпорта (только горизонтальные отступы).
 * md+: фиксированные «ступени»: 768 → 1024 → 1440 → 1920 px.
 */
export const CONTENT_MAX_WIDTH_CLASS =
  'mx-auto w-full px-4 md:max-w-[768px] md:px-6 lg:max-w-[1024px] laptop:max-w-[1440px] laptop:px-8 desktop:max-w-[1920px] desktop:px-10';

export function contentMaxWidthClassName(className?: string) {
  return cn(CONTENT_MAX_WIDTH_CLASS, className);
}
