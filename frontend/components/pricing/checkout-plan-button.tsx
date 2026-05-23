'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/types';
import { notifyError } from '@/lib/notify';

type Props = {
  planId: number;
  planCode: string;
  label?: string;
  'aria-label'?: string;
};

export function CheckoutPlanButton({
  planId,
  planCode,
  label = 'Оформить',
  'aria-label': ariaLabel,
}: Props) {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const [loading, setLoading] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  if (planCode === 'FREE') {
    const freeLabel = label === 'Оформить' ? 'Начать бесплатно' : label;
    return (
      <Button asChild className="w-full" variant="secondary">
        <Link href="/register" aria-label={ariaLabel}>
          {freeLabel}
        </Link>
      </Button>
    );
  }

  async function onClick() {
    await hydrate();
    if (!useAuthStore.getState().isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent('/pricing')}`);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ confirmationUrl: string; paymentId: number }>(
        '/payments/yookassa/checkout',
        { method: 'POST', body: { planId, autoRenew } },
      );
      window.location.href = res.confirmationUrl;
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Не удалось создать оплату');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <label className="flex cursor-pointer items-start gap-2 text-left text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 rounded border-input"
          checked={autoRenew}
          onChange={(e) => setAutoRenew(e.target.checked)}
        />
        <span>
          Автопродление: сохранить способ оплаты в ЮKassa и продлевать подписку до отмены (можно снять галочку).
        </span>
      </label>
      <Button
        type="button"
        className="w-full"
        disabled={loading}
        onClick={onClick}
        aria-label={ariaLabel}>
        {loading ? 'Переход к оплате…' : label}
      </Button>
    </div>
  );
}
