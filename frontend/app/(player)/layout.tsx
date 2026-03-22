import React, { Suspense } from 'react';
import { Container } from '@/components/shared/container';
import Header from '@/components/shared/header';

export default function PlayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <Container className="py-8 md:py-10">{children}</Container>
    </main>
  );
}
