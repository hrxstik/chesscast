'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchMyOrganizationMembership } from '@/lib/api/organizations';

const allSegments = (orgId: string) =>
  [
    { href: `/organization/${orgId}`, label: 'Обзор', adminOnly: false },
    { href: `/organization/${orgId}/games`, label: 'Игры', adminOnly: false },
    { href: `/organization/${orgId}/settings`, label: 'Настройки', adminOnly: true },
    { href: `/organization/${orgId}/logs`, label: 'Журнал', adminOnly: true },
  ] as const;

function normPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '');
}

/** «Обзор» — только /organization/:id, без вложенных /games, /settings … */
function isOrgNavActive(pathname: string, href: string, orgId: string): boolean {
  const path = normPath(pathname);
  const link = normPath(href);
  const base = orgId ? normPath(`/organization/${orgId}`) : null;

  if (base && link === base) {
    return path === base;
  }

  return path === link || path.startsWith(`${link}/`);
}

export function OrgSubNav({ orgId: orgIdProp }: { orgId: string }) {
  const pathname = usePathname();
  const params = useParams();
  const routeId = typeof params?.id === 'string' ? params.id : '';
  const orgId = orgIdProp || routeId;
  const [isAdmin, setIsAdmin] = useState(false);
  const orgNum = Number(orgId);

  useEffect(() => {
    if (!orgId || Number.isNaN(orgNum)) return;
    void (async () => {
      try {
        const m = await fetchMyOrganizationMembership(orgNum);
        setIsAdmin(m.isAdmin);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [orgId, orgNum]);

  const items = allSegments(orgId).filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4"
      aria-label="Разделы организации">
      {items.map(({ href, label }) => {
        const active = isOrgNavActive(pathname, href, orgId);
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
