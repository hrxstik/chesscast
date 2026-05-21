'use client';

import { AppShell } from '@/components/layout/app-shell';
import {
  getDashboardNavItems,
  isDashboardNavActive,
} from '@/components/layout/dashboard-nav-items';
import { useAuthStore } from '@/store/auth-store';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  title?: string;
};

export function DashboardShell({ children, title }: Props) {
  const user = useAuthStore((s) => s.user);
  const role = user?.platformRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER';
  const navItems = getDashboardNavItems(role);
  const pathname = usePathname();

  return (
    <>
      <AppShell navItems={navItems} title={title}>
        {children}
      </AppShell>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 px-2 py-2 backdrop-blur-md md:hidden"
        aria-label="Разделы дашборда">
        <div className="mx-auto flex w-full max-w-lg justify-around gap-1">
          {navItems.slice(0, 5).map((item) => {
            const active = isDashboardNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}>
                <span className="[&_svg]:size-5">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="h-16 md:hidden" aria-hidden />
    </>
  );
}
