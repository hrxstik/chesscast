import Footer from '@/components/shared/footer';
import Header from '@/components/shared/header';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Главная',
};

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen flex-col bg-gray-100 dark:bg-background">
      <Suspense>
        <Header />
      </Suspense>
      <div className="flex flex-1 flex-col">{children}</div>
      <Suspense>
        <Footer />
      </Suspense>
    </main>
  );
}
