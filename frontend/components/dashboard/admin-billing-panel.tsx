"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchBillingEvents,
  fetchBillingSummary,
  type BillingEventRow,
  type BillingSummaryDto,
} from "@/lib/api/admin-billing";
import { ApiError } from "@/lib/api/types";
import { notifyError } from "@/lib/notify";
import toast from "react-hot-toast";
import { Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/utils";

const CSV_COLUMNS = [
  { key: "id", example: "12" },
  { key: "type", example: "INVOICE_PAID" },
  { key: "amount", example: "1490.00" },
  { key: "currency", example: "RUB" },
  { key: "createdAt", example: "2026-05-22T10:15:00.000Z" },
  { key: "paymentId", example: "8" },
  { key: "actorUserId", example: "104" },
  { key: "actorName", example: "demo_player" },
  { key: "paymentStatus", example: "SUCCEEDED" },
] as const;

export function AdminBillingPanel() {
  const [summary, setSummary] = useState<BillingSummaryDto | null>(null);
  const [events, setEvents] = useState<BillingEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ev] = await Promise.all([
        fetchBillingSummary({
          from: from || undefined,
          to: to || undefined,
        }),
        fetchBillingEvents({ limit: 20 }),
      ]);
      setSummary(s);
      setEvents(ev.items);
    } catch (e) {
      notifyError(
        e instanceof ApiError
          ? e.message
          : "Не удалось загрузить бухгалтерию (нужен вход супер-админа).",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`${getApiUrl()}/admin/billing/events/export`, {
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing-events-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV выгружен");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Не удалось выгрузить CSV");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <Text className="text-sm text-muted-foreground">Загрузка…</Text>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <input
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Период с"
        />
        <input
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="Период по"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-9"
          onClick={() => void load()}
        >
          Применить период
        </Button>
      </div>
      {summary ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">
              Выручка (успешные)
            </Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {summary.revenue} {summary.currency}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">Платежи</Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {summary.paymentCount}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <Text className="text-xs text-muted-foreground">
              Возвраты (шт.)
            </Text>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {summary.refunds}
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">События биллинга</Text>
        </div>
        <ul className="max-h-64 divide-y divide-border overflow-auto text-sm">
          {events.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">
              Нет событий
            </li>
          ) : (
            events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  #{ev.id}
                </span>
                <span className="font-medium">{ev.type}</span>
                {ev.amount != null ? (
                  <span className="tabular-nums text-muted-foreground">
                    {ev.amount} {ev.currency ?? ""}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {new Date(ev.createdAt).toLocaleString("ru-RU")}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">
            Структура CSV при экспорте
          </Text>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 font-medium">Колонка</th>
                <th className="px-3 py-2 font-medium">Пример значения</th>
              </tr>
            </thead>
            <tbody>
              {CSV_COLUMNS.map((c) => (
                <tr key={c.key} className="border-b border-border/60">
                  <td className="px-3 py-2 font-mono">{c.key}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-8 text-xs"
        disabled={exporting}
        onClick={() => void onExportCsv()}
      >
        {exporting ? "Выгрузка…" : "Экспорт в CSV"}
      </Button>
    </div>
  );
}
