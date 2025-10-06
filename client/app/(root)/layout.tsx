import { Container } from '@/components/shared/container';
import Header from '@/components/shared/header';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'ChessCast | Get started',
};

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-gray-100 dark:bg-background">
      <Suspense>
        <Header />
      </Suspense>
      <Container>{children}</Container>
    </main>
  );
}
