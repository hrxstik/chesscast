'use client';

import { useEffect, useState } from 'react';

/** true только на клиенте после mount — чтобы не редиректить до гидрации и persist zustand. */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
