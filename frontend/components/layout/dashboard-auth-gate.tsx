'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';
import { useClientMounted } from '@/lib/hooks/use-client-mounted';
import { Text } from '@/components/ui/typography';
import { getCurrentUser } from '@/lib/api/user';

/**
 * Дашборд только для авторизованных. Без токена → /login?next=...
 * Если токен есть, а профиль в сторе пуст (старая сессия) — подгружаем GET /user/me.
 */
export function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const mounted = useClientMounted();

  const loginHref =
    pathname && pathname !== '/login'
      ? `/login?next=${encodeURIComponent(pathname)}`
      : '/login?next=/dashboard';

  useEffect(() => {
    if (!mounted || accessToken) return;
    router.replace(loginHref);
  }, [mounted, accessToken, router, loginHref]);

  useEffect(() => {
    if (!mounted || !accessToken || user) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        setUser({
          id: me.id,
          name: me.name,
          email: me.email,
          platformRole: me.platformRole,
          avatar: me.avatar,
        });
      } catch {
        if (cancelled) return;
        clearAuth();
        clearUser();
        router.replace(loginHref);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mounted,
    accessToken,
    user,
    setUser,
    clearAuth,
    clearUser,
    router,
    loginHref,
  ]);

  if (!mounted) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Text className="text-muted-foreground">Загрузка…</Text>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Text className="text-muted-foreground">Перенаправление на вход…</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <Text className="text-muted-foreground">Загрузка профиля…</Text>
      </div>
    );
  }

  return <>{children}</>;
}
