import {
  LayoutDashboard,
  Building2,
  Gamepad2,
  Shield,
  User,
} from 'lucide-react';
import type { NavItem } from '@/components/layout/app-shell';

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
