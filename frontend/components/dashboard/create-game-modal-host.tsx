'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { CreateGameModal } from '@/components/dashboard/create-game-modal';
import {
  parseCreateGameModal,
} from '@/lib/create-game-modal-url';

type Props = {
  /** organizationId из URL страницы, если модалка без query organizationId */
  defaultOrganizationId?: number;
};

export function CreateGameModalHost({ defaultOrganizationId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { open, organizationId } = useMemo(
    () => parseCreateGameModal(searchParams),
    [searchParams],
  );

  const orgId = organizationId ?? defaultOrganizationId;

  const onClose = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('createGame');
    next.delete('organizationId');
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <CreateGameModal
      open={open}
      onClose={onClose}
      organizationId={orgId}
    />
  );
}
