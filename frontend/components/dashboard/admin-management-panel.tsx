'use client';

import { useCallback, useEffect, useState } from 'react';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import {
  fetchAdminOrganizations,
  fetchAdminUsers,
  setAdminOrganizationBlocked,
  setAdminUserBlocked,
  setAdminUserRole,
  type AdminOrganizationRow,
  type AdminUserRow,
} from '@/lib/api/admin-management';
import { ApiError } from '@/lib/api/types';

export function AdminManagementPanel() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganizationRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [orgQuery, setOrgQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [u, o] = await Promise.all([fetchAdminUsers(userQuery), fetchAdminOrganizations(orgQuery)]);
      setUsers(u.items);
      setOrganizations(o.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить админ-данные');
    }
  }, [userQuery, orgQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleUserBlocked(row: AdminUserRow) {
    try {
      await setAdminUserBlocked(row.id, !row.blocked, !row.blocked ? blockReason : undefined);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить пользователя');
    }
  }

  async function onToggleOrgBlocked(row: AdminOrganizationRow) {
    try {
      await setAdminOrganizationBlocked(row.id, !row.blocked, !row.blocked ? blockReason : undefined);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить организацию');
    }
  }

  async function onToggleRole(row: AdminUserRow) {
    try {
      await setAdminUserRole(row.id, row.platformRole === 'SUPERADMIN' ? 'USER' : 'SUPERADMIN');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить роль');
    }
  }

  return (
    <div className="space-y-6">
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      <input
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={blockReason}
        onChange={(e) => setBlockReason(e.target.value)}
        placeholder="Причина блокировки (опционально)"
      />

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">Пользователи</Text>
          <input
            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Поиск по имени или email"
          />
        </div>
        <ul className="divide-y divide-border text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">#{u.id}</span>
              <span>{u.name}</span>
              <span className="text-muted-foreground">{u.email}</span>
              <span className="text-xs text-muted-foreground">{u.platformRole}</span>
              {u.blocked && u.blockedReason ? (
                <span className="text-xs text-muted-foreground">Причина: {u.blockedReason}</span>
              ) : null}
              <Button className="ml-auto h-8 text-xs" variant="outline" onClick={() => void onToggleRole(u)}>
                Переключить роль
              </Button>
              <Button className="h-8 text-xs" variant={u.blocked ? 'secondary' : 'destructive'} onClick={() => void onToggleUserBlocked(u)}>
                {u.blocked ? 'Разблокировать' : 'Блокировать'}
              </Button>
            </li>
          ))}
          {users.length === 0 ? <li className="px-4 py-3 text-muted-foreground">Нет данных</li> : null}
        </ul>
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">Организации</Text>
          <input
            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={orgQuery}
            onChange={(e) => setOrgQuery(e.target.value)}
            placeholder="Поиск по названию"
          />
        </div>
        <ul className="divide-y divide-border text-sm">
          {organizations.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="font-mono text-xs text-muted-foreground">#{o.id}</span>
              <span>{o.name}</span>
              <span className="text-xs text-muted-foreground">invite: {o.inviteCode}</span>
              {o.blocked && o.blockedReason ? (
                <span className="text-xs text-muted-foreground">Причина: {o.blockedReason}</span>
              ) : null}
              <Button
                className="ml-auto h-8 text-xs"
                variant={o.blocked ? 'secondary' : 'destructive'}
                onClick={() => void onToggleOrgBlocked(o)}>
                {o.blocked ? 'Разблокировать' : 'Блокировать'}
              </Button>
            </li>
          ))}
          {organizations.length === 0 ? (
            <li className="px-4 py-3 text-muted-foreground">Нет данных</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
