'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  const loginHref =
    pathname && pathname !== '/login'
      ? `/login?next=${encodeURIComponent(pathname)}`
      : '/login?next=/dashboard';

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace(loginHref);
    }
  }, [isHydrated, isAuthenticated, router, loginHref]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
