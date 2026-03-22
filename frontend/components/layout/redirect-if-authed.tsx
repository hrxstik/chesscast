'use client';

import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Text } from '@/components/ui/typography';

/**
 * После rehydrate zustand persist: если уже есть токен — уводим с /login и /register.
 */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (accessToken) {
      router.replace('/dashboard');
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Text className="text-muted-foreground">Загрузка…</Text>
      </div>
    );
  }

  if (accessToken) {
    return null;
  }

  return children;
}
