'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Старые ссылки /create-game?... → модалка на games или organization. */
export default function CreateGameLegacyRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = new URLSearchParams({ createGame: '1' });
    const orgRaw = searchParams.get('organizationId');
    if (orgRaw) {
      q.set('organizationId', orgRaw);
      router.replace(`/organization/${orgRaw}?${q.toString()}`);
      return;
    }
    router.replace(`/dashboard/games?${q.toString()}`);
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-muted-foreground">Открываем форму создания игры…</p>
  );
}
