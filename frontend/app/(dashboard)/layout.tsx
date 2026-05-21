import React, { Suspense } from 'react';
import Header from '@/components/shared/header';
import { DashboardAuthGate } from '@/components/layout/dashboard-auth-gate';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CreateGameModalHost } from '@/components/dashboard/create-game-modal-host';

interface Props {
  children: React.ReactNode;
  modal: React.ReactNode;
}

export default function DashboardLayout({ children, modal }: Props) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <DashboardAuthGate>
        <DashboardShell>{children}</DashboardShell>
      </DashboardAuthGate>
      {modal}
      <Suspense fallback={null}>
        <CreateGameModalHost />
      </Suspense>
    </main>
  );
}
