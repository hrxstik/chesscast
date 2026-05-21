"use client";

import { useCallback, useEffect, useState } from "react";
import { Text } from "@/components/ui/typography";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  fetchAdminServiceLogs,
  type AdminServiceLogRow,
} from "@/lib/api/admin-management";
import { ApiError } from "@/lib/api/types";

export function AdminServiceLogsPanel() {
  const [rows, setRows] = useState<AdminServiceLogRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminServiceLogs({
        type: typeFilter || undefined,
        limit: 100,
      });
      setRows(res.items);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить журнал",
      );
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <Select
        value={typeFilter}
        onValueChange={setTypeFilter}
        options={[
          { value: "", label: "Все типы" },
          { value: "AUTH", label: "AUTH" },
          { value: "MODERATION", label: "MODERATION" },
          { value: "BILLING", label: "BILLING" },
          { value: "ORG", label: "ORG" },
          { value: "PLAN", label: "PLAN" },
        ]}
        aria-label="Тип события"
      />
      {loading ? (
        <Text className="text-sm text-muted-foreground">Загрузка…</Text>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  #{r.id}
                </span>
                <Badge variant="outline">{r.type}</Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("ru-RU")}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {r.actorName}
                </span>
              </div>
              <p>{r.message}</p>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">
              Нет событий
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
