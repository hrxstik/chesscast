'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';
import { Text } from '@/components/ui/typography';

export default function GoogleAuthSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    const token = params.get('token');
    const id = params.get('id');
    const name = params.get('name');
    const email = params.get('email');
    const platformRole = params.get('platformRole');
    if (!token || !id || !name || !email) {
      router.replace('/login');
      return;
    }
    setAccessToken(token);
    setUser({
      id: Number(id),
      name,
      email,
      platformRole: platformRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER',
    });
    router.replace('/dashboard');
  }, [params, router, setAccessToken, setUser]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Text className="text-muted-foreground">Завершаем вход через Google…</Text>
    </div>
  );
}
