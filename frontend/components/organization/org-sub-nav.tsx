'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const segments = (orgId: string) =>
  [
    { href: `/organization/${orgId}`, label: 'Обзор' },
    { href: `/organization/${orgId}/settings`, label: 'Настройки' },
    { href: `/organization/${orgId}/logs`, label: 'Журнал' },
  ] as const;

export function OrgSubNav({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const items = segments(orgId);

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4"
      aria-label="Разделы организации">
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
