import Header from '@/components/shared/header';
import React, { Suspense } from 'react';

type Props = {};

export default function PlayerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div>{children}</div>;
}
