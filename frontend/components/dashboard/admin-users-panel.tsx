'use client';

import { useCallback, useEffect, useState } from 'react';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { AdminEffectCallout } from '@/components/dashboard/admin-effect-callout';
import { AdminModerationDialog } from '@/components/dashboard/admin-moderation-dialog';
import {
  fetchAdminUsers,
  setAdminUserBlocked,
  type AdminUserRow,
} from '@/lib/api/admin-management';
import { ApiError } from '@/lib/api/types';

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState('');
  const [blockedFilter, setBlockedFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({
        q: query || undefined,
        blocked:
          blockedFilter === 'true'
            ? true
            : blockedFilter === 'false'
              ? false
              : undefined,
      });
      setUsers(res.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить пользователей');
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
      <AdminEffectCallout title="Что происходит при блокировке пользователя">
        <ul className="list-inside list-disc space-y-1">
          <li>Вход в аккаунт и обновление сессии будут отклонены с сообщением «Аккаунт заблокирован».</li>
          <li>Создание игр, вступление в организации и оплата тарифа для этого пользователя недоступны.</li>
          <li>Причина сохраняется в профиле и в служебном журнале аудита.</li>
          <li>Разблокировка снимает ограничение, причина в журнале фиксируется снова.</li>
        </ul>
      </AdminEffectCallout>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <div className="flex flex-wrap items-end gap-2">
        <input
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или email"
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
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">#{u.id}</span>
              <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground">{u.email}</span>
              {u.blocked ? (
                <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  заблокирован
                </span>
              ) : null}
              {u.blockedReason ? (
                <span className="text-xs text-muted-foreground">Причина: {u.blockedReason}</span>
              ) : null}
              <Button
                className="ml-auto h-8 text-xs"
                variant={u.blocked ? 'secondary' : 'destructive'}
                onClick={() => setPending(u)}
              >
                {u.blocked ? 'Разблокировать' : 'Заблокировать'}
              </Button>
            </li>
          ))}
          {users.length === 0 ? (
            <li className="px-4 py-6 text-center text-muted-foreground">Нет записей</li>
          ) : null}
        </ul>
      )}

      {pending ? (
        <AdminModerationDialog
          open={!!pending}
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.blocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
          description={`${pending.name} (${pending.email})`}
          effectHint={
            pending.blocked ? (
              <p>Пользователь снова сможет входить и пользоваться платформой.</p>
            ) : (
              <p>Будет запрещён вход и действия от имени этого аккаунта до разблокировки.</p>
            )
          }
          confirmLabel={pending.blocked ? 'Разблокировать' : 'Заблокировать'}
          variant={pending.blocked ? 'secondary' : 'destructive'}
          onConfirm={async (reason) => {
            await setAdminUserBlocked(pending.id, !pending.blocked, reason);
            await load();
            setPending(null);
          }}
        />
      ) : null}
    </div>
  );
}
