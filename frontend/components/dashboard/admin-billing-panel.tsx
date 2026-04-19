'use client';

import { useEffect, useState } from 'react';
import {
  fetchBillingEvents,
  fetchBillingSummary,
  type BillingEventRow,
  type BillingSummaryDto,
} from '@/lib/api/admin-billing';
import { ApiError } from '@/lib/api/types';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { getApiUrl } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

export function AdminBillingPanel() {
  const token = useAuthStore((s) => s.accessToken);
  const [summary, setSummary] = useState<BillingSummaryDto | null>(null);
  const [events, setEvents] = useState<BillingEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, ev] = await Promise.all([
          fetchBillingSummary(),
          fetchBillingEvents({ limit: 20 }),
        ]);
        if (!cancelled) {
          setSummary(s);
          setEvents(ev.items);
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof ApiError
              ? e.message
              : 'Не удалось загрузить бухгалтерию (нужен вход супер-админа).';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Text className="text-sm text-muted-foreground">Загрузка…</Text>;
  }

  if (error) {
    return <Text className="text-sm text-destructive">{error}</Text>;
  }

  async function onExportCsv() {
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/admin/billing/events/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-events-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выгрузить CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">Выручка (успешные)</Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {summary.revenue} {summary.currency}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">Платежи</Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">{summary.paymentCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">Возвраты (шт.)</Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">{summary.refunds}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">События биллинга</Text>
        </div>
        <ul className="max-h-64 divide-y divide-border overflow-auto text-sm">
          {events.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">Нет событий</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
                <span className="font-mono text-xs text-muted-foreground">#{ev.id}</span>
                <span className="font-medium">{ev.type}</span>
                {ev.amount != null ? (
                  <span className="tabular-nums text-muted-foreground">
                    {ev.amount} {ev.currency ?? ''}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-8 text-xs"
        disabled={exporting}
        onClick={() => void onExportCsv()}>
        {exporting ? 'Выгрузка…' : 'Экспорт CSV (сервер)'}
      </Button>
    </div>
  );
}
