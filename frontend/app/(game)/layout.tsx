import { Container } from '@/components/shared/container';
import Header from '@/components/shared/header';
import React, { Suspense } from 'react';

type Props = {
  children: React.ReactNode;
};

export default function GameLayout({ children }: Props) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <Container className="py-4 md:py-6">{children}</Container>
    </main>
  );
}
