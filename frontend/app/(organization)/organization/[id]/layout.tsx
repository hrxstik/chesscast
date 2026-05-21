'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/section';
import { OrganizationMemberGate } from '@/components/organization/organization-member-gate';

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default function OrganizationLayout({ children, params }: Props) {
  const [id, setId] = useState('');

  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  return (
    <Section>
      {id ? (
        <OrganizationMemberGate orgId={id}>{children}</OrganizationMemberGate>
      ) : null}
    </Section>
  );
}
