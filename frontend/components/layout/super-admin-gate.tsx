'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

const ADMIN_PATH = '/dashboard/admin';

export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(ADMIN_PATH)}`);
      return;
    }
    if (user && user.platformRole !== 'SUPERADMIN') {
      router.replace('/dashboard');
    }
  }, [isHydrated, isAuthenticated, user, router]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  if (!user || user.platformRole !== 'SUPERADMIN') {
    return null;
  }

  return <>{children}</>;
}
