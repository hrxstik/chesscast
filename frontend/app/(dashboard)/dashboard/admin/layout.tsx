import React from 'react';
import { SuperAdminGate } from '@/components/layout/super-admin-gate';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperAdminGate>{children}</SuperAdminGate>;
}
