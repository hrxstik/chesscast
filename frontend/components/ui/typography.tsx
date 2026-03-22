import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Ровно 5 ступеней ширины: max-md (база) → md (768) → lg (1024) → laptop (1440) → desktop (1920).
 * Не используем tailwind sm / xl / 2xl для сетки типографики.
 */
const h1 =
  'text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl laptop:text-5xl desktop:text-6xl';
const h2 =
  'text-xl font-semibold tracking-tight md:text-2xl lg:text-3xl laptop:text-4xl desktop:text-4xl';
const h3 =
  'text-lg font-semibold tracking-tight md:text-xl lg:text-2xl laptop:text-3xl desktop:text-3xl';
const lead =
  'text-sm text-muted-foreground md:text-base lg:text-lg laptop:text-xl desktop:text-xl leading-relaxed';
const p =
  'text-sm md:text-base lg:text-base laptop:text-lg desktop:text-lg leading-relaxed';
const muted =
  'text-xs text-muted-foreground md:text-sm lg:text-sm laptop:text-base desktop:text-base';

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & { children: ReactNode };

export function H1({ className, children, ...props }: HeadingProps) {
  return (
    <h1 className={cn(h1, className)} {...props}>
      {children}
    </h1>
  );
}

export function H2({ className, children, ...props }: HeadingProps) {
  return (
    <h2 className={cn(h2, className)} {...props}>
      {children}
    </h2>
  );
}

export function H3({ className, children, ...props }: HeadingProps) {
  return (
    <h3 className={cn(h3, className)} {...props}>
      {children}
    </h3>
  );
}

export function Lead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn(lead, className)} {...props}>
      {children}
    </p>
  );
}

export function Text({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn(p, className)} {...props}>
      {children}
    </p>
  );
}

export function Muted({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cn(muted, className)} {...props}>
      {children}
    </p>
  );
}
