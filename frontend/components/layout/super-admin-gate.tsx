'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { useAuthStore } from '@/store/auth-store';
import { Text } from '@/components/ui/typography';
import { useClientMounted } from '@/lib/hooks/use-client-mounted';

const ADMIN_PATH = '/dashboard/admin';

/**
 * Супер-админка: без входа → /login?next=/dashboard/admin; обычный пользователь → /dashboard.
 * Данные из persist zustand; бекенд для админ-API защищать отдельно.
 */
export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const mounted = useClientMounted();

  useEffect(() => {
    if (!mounted) return;
    if (!accessToken) {
      router.replace(`/login?next=${encodeURIComponent(ADMIN_PATH)}`);
      return;
    }
    if (user && user.platformRole !== 'SUPERADMIN') {
      router.replace('/dashboard');
    }
  }, [mounted, accessToken, user, router]);

  if (!mounted) {
    return (
      <div className="p-6">
        <Text className="text-muted-foreground">Загрузка…</Text>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="p-6">
        <Text className="text-muted-foreground">Перенаправление на вход…</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Text className="text-muted-foreground">Загрузка профиля…</Text>
      </div>
    );
  }

  if (user.platformRole !== 'SUPERADMIN') {
    return null;
  }

  return <>{children}</>;
}
