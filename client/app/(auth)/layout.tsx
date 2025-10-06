import Header from '@/components/shared/header';
import React from 'react';

type Props = { children: Readonly<React.ReactNode> };

export default function AuthLayout({ children }: Props) {
  return (
    <div>
      <Header />
      <div className="min-h-[90vh] flex items-center justify-center bg-gray-50"> {children}</div>
    </div>
  );
}
