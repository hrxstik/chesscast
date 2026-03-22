import { cn } from '@/lib/utils';
import { CONTENT_MAX_WIDTH_CLASS } from '@/lib/layout-classes';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type NavItem = { href: string; label: string; icon?: ReactNode };

type AppShellProps = {
  navItems: NavItem[];
  children: ReactNode;
  title?: string;
  className?: string;
};

export function AppShell({ navItems, children, title, className }: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-background', className)}>
      <div
        className={cn(
          'flex gap-6 py-6 md:gap-8 laptop:gap-10',
          CONTENT_MAX_WIDTH_CLASS,
        )}>
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
