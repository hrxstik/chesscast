import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function DashboardLayout({ children, className }: Props) {
  return <div className={className}>{children}</div>;
}
