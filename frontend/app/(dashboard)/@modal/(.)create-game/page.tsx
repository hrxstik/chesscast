'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { CreateGameModal } from '@/components/dashboard/create-game-modal';
import { parseCreateGameModal } from '@/lib/create-game-modal-url';

/** Intercept /create-game внутри dashboard → та же модалка. */
export default function CreateGameInterceptModalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merged = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('createGame', '1');
    return p;
  }, [searchParams]);
  const { organizationId } = parseCreateGameModal(merged);

  return (
    <CreateGameModal
      open
      organizationId={organizationId}
      onClose={() => router.back()}
    />
  );
}
