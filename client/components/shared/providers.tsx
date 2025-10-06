'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';
import NextTopLoader from 'nextjs-toploader';
import { ThemeProvider } from 'next-themes';

export const Providers: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
        <NextTopLoader />
      </ThemeProvider>
    </>
  );
};
