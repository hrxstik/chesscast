import React, { Suspense } from 'react';
import Header from '@/components/shared/header';
import { DashboardAuthGate } from '@/components/layout/dashboard-auth-gate';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CreateGameModalHost } from '@/components/dashboard/create-game-modal-host';
import type { ReactNode } from 'react';

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <DashboardAuthGate>
        <DashboardShell>{children}</DashboardShell>
      </DashboardAuthGate>
      <Suspense fallback={null}>
        <CreateGameModalHost />
      </Suspense>
    </main>
  );
}
