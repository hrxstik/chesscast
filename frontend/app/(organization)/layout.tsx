import { Container } from '@/components/shared/container';
import Header from '@/components/shared/header';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { CreateGameModalHost } from '@/components/dashboard/create-game-modal-host';

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <Container className="py-8 md:py-10">{children}</Container>
      <Suspense fallback={null}>
        <CreateGameModalHost />
      </Suspense>
    </main>
  );
}
