import {
  LayoutDashboard,
  Building2,
  Gamepad2,
  Shield,
  User,
} from 'lucide-react';
import type { NavItem } from '@/components/layout/app-shell';

/** Нормализованный путь без завершающего слэша */
function normPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '');
}

export function isDashboardNavActive(pathname: string, href: string): boolean {
  const path = normPath(pathname);

  // Страницы организации — в дашборде активен только пункт «Организации»
  if (path.startsWith('/organization')) {
    return href === '/dashboard/organizations';
  }

  // «Обзор» (/dashboard) — только точное совпадение, не /dashboard/games и т.д.
  if (href === '/dashboard') {
    return path === '/dashboard';
  }

  return path === href || path.startsWith(`${href}/`);
}

export function getDashboardNavItems(role: 'USER' | 'SUPERADMIN'): NavItem[] {
  const base: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Обзор',
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      href: '/dashboard/games',
      label: 'Мои игры',
      icon: <Gamepad2 className="size-4" />,
    },
    {
      href: '/dashboard/organizations',
      label: 'Организации',
      icon: <Building2 className="size-4" />,
    },
    {
      href: '/dashboard/profile',
      label: 'Профиль',
      icon: <User className="size-4" />,
    },
  ];

  if (role === 'SUPERADMIN') {
    return [
      {
        href: '/dashboard/admin',
        label: 'Администрирование',
        icon: <Shield className="size-4" />,
      },
      ...base,
    ];
  }

  return base;
}
