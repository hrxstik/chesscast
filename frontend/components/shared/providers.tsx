'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import NextTopLoader from 'nextjs-toploader';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/components/providers/query-provider';

export const Providers: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange>
        {children}
        <Toaster position="top-center" />
        <NextTopLoader color="var(--primary)" height={3} showSpinner={false} />
      </ThemeProvider>
    </QueryProvider>
  );
};
