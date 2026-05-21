'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMyOrganizationMembership } from '@/lib/api/organizations';
import { Text } from '@/components/ui/typography';

type Props = {
  orgId: string;
  children: React.ReactNode;
};

/** Только для администратора организации (владелец или роль ADMIN). */
export function OrgAdminGate({ orgId, children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const orgNum = Number(orgId);

  useEffect(() => {
    if (!orgId || Number.isNaN(orgNum)) {
      setAllowed(false);
      return;
    }
    void (async () => {
      try {
        const m = await fetchMyOrganizationMembership(orgNum);
        if (!m.isAdmin) {
          router.replace(`/organization/${orgId}`);
          return;
        }
        setAllowed(true);
      } catch {
        router.replace(`/organization/${orgId}`);
      }
    })();
  }, [orgId, orgNum, router]);

  if (allowed === null) {
    return <Text className="text-muted-foreground">Проверка доступа…</Text>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
