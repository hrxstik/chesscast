'use client';

import { useCallback, useEffect, useState } from 'react';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AdminEffectCallout } from '@/components/dashboard/admin-effect-callout';
import { AdminModerationDialog } from '@/components/dashboard/admin-moderation-dialog';
import {
  fetchAdminOrganizations,
  setAdminOrganizationBlocked,
  type AdminOrganizationRow,
} from '@/lib/api/admin-management';
import { ApiError } from '@/lib/api/types';
import { notifyError } from '@/lib/notify';

export function AdminOrganizationsPanel() {
  const [rows, setRows] = useState<AdminOrganizationRow[]>([]);
  const [query, setQuery] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<AdminOrganizationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminOrganizations({
        q: query || undefined,
        blocked:
          blockedFilter === 'true'
            ? true
            : blockedFilter === 'false'
              ? false
              : undefined,
      });
      setRows(res.items);
    } catch (e) {
      notifyError(
        e instanceof ApiError ? e.message : 'Не удалось загрузить организации',
      );
    } finally {
      setLoading(false);
    }
  }, [query, blockedFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 280);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <AdminEffectCallout title="Что происходит при блокировке организации">
        <ul className="list-inside list-disc space-y-1">
          <li>Новое вступление в клуб и создание игр в этой организации будут отклонены.</li>
          <li>Организация считается неактивной: действия участников и администраторов клуба ограничены.</li>
          <li>Существующие игры и история сохраняются, карточка клуба остаётся в БД.</li>
          <li>Причина отображается в журнале аудита и в данных модерации.</li>
        </ul>
      </AdminEffectCallout>

      <div className="flex flex-wrap items-end gap-2">
        <input
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию"
        />
        <Select
          value={blockedFilter}
          onValueChange={setBlockedFilter}
          options={[
            { value: '', label: 'Все' },
            { value: 'false', label: 'Активные' },
            { value: 'true', label: 'Заблокированные' },
          ]}
          aria-label="Фильтр по блокировке"
        />
        <Button type="button" variant="secondary" className="h-9" onClick={() => void load()}>
          Обновить
        </Button>
      </div>
      {loading ? (
        <Text className="text-sm text-muted-foreground">Загрузка…</Text>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">#{o.id}</span>
              <span className="font-medium">{o.name}</span>
              <span className="text-xs text-muted-foreground">код: {o.inviteCode}</span>
              {o.blocked ? (
                <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  заблокирована
                </span>
              ) : null}
              {o.blockedReason ? (
                <span className="text-xs text-muted-foreground">Причина: {o.blockedReason}</span>
              ) : null}
              <Button
                className="ml-auto h-8 text-xs"
                variant={o.blocked ? 'secondary' : 'destructive'}
                onClick={() => setPending(o)}
              >
                {o.blocked ? 'Разблокировать' : 'Заблокировать'}
              </Button>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">Нет записей</li>
          ) : null}
        </ul>
      )}

      {pending ? (
        <AdminModerationDialog
          open={!!pending}
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.blocked ? 'Разблокировать организацию' : 'Заблокировать организацию'}
          description={pending.name}
          effectHint={
            pending.blocked ? (
              <p>Участники снова смогут вступать и проводить игры в клубе (при активной подписке владельца).</p>
            ) : (
              <p>Клуб станет недоступен для вступления и операций до снятия блокировки.</p>
            )
          }
          confirmLabel={pending.blocked ? 'Разблокировать' : 'Заблокировать'}
          variant={pending.blocked ? 'secondary' : 'destructive'}
          onConfirm={async (reason) => {
            await setAdminOrganizationBlocked(pending.id, !pending.blocked, reason);
            await load();
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
