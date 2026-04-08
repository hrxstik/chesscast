'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, Lead, Text } from '@/components/ui/typography';
import { Building2, Hash, Mail, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  fetchMyOrganizations,
  joinOrganizationByCode,
  searchOrganizations,
  type OrganizationSearchDto,
  type MyOrganizationDto,
} from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';

export default function DashboardOrganizationsPage() {
  const [rows, setRows] = useState<MyOrganizationDto[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchRows, setSearchRows] = useState<OrganizationSearchDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyOrganizations();
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить организации');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onJoin() {
    if (!inviteCode.trim()) return;
    setJoining(true);
    setError(null);
    try {
      await joinOrganizationByCode(inviteCode.trim());
      setInviteCode('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось вступить в организацию');
    } finally {
      setJoining(false);
    }
  }

  async function onSearch() {
    if (!searchText.trim()) {
      setSearchRows([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const byId = Number(searchText.trim());
      const res = await searchOrganizations({
        q: Number.isNaN(byId) ? searchText.trim() : undefined,
        id: Number.isNaN(byId) ? undefined : byId,
      });
      setSearchRows(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось выполнить поиск организаций');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <H2>Организации</H2>
          <Lead className="mt-2 max-w-2xl">
            Клубы, в которые вы входите, и приглашения по коду. Управление для админа организации —
            из карточки организации.
          </Lead>
        </div>
        <Button asChild className="w-full shrink-0 gap-2 md:w-auto">
          <Link href="/organization/create">
            <Plus className="size-4" aria-hidden />
            Создать организацию
          </Link>
        </Button>
      </div>

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Список организаций</CardTitle>
              <Text className="text-sm text-muted-foreground">Ваши организации и роли</Text>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Text className="text-sm text-muted-foreground">Загрузка…</Text>
            ) : rows.length === 0 ? (
              <Text className="text-sm text-muted-foreground">Вы пока не состоите в организациях.</Text>
            ) : (
              rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      роль: {r.role} · {r.isActive ? 'активна' : 'неактивна'}
                    </div>
                  </div>
                  <Button asChild variant="outline" className="h-8 text-xs">
                    <Link href={`/organization/${r.id}`}>Открыть</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="size-4 text-primary" aria-hidden />
              Вступить по коду
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-sm text-muted-foreground">
              Введите invite-код организации.
            </Text>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Например: SEED-DEMO-SCHOOL"
              />
              <Button onClick={() => void onJoin()} disabled={joining} className="sm:shrink-0">
                {joining ? 'Вступление…' : 'Вступить'}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              Вступление доступно по invite-коду организации.
            </div>

            <div className="space-y-2 rounded-lg border border-border/80 p-3">
              <Text className="text-sm font-medium">Поиск организации (ID или название)</Text>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Например: 12 или Chess Club"
                />
                <Button onClick={() => void onSearch()} disabled={searching} className="sm:shrink-0">
                  {searching ? 'Поиск…' : 'Найти'}
                </Button>
              </div>
              <div className="space-y-2">
                {searchRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded border border-border px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        #{r.id} · {r.isActive ? 'активна' : 'неактивна'} ·{' '}
                        {r.isMember ? `вы участник (${r.role})` : 'вы не участник'}
                      </div>
                    </div>
                    <Button asChild variant="outline" className="h-8 text-xs">
                      <Link href={`/organization/${r.id}`}>Открыть</Link>
                    </Button>
                  </div>
                ))}
                {searchText.trim() && !searching && searchRows.length === 0 ? (
                  <Text className="text-xs text-muted-foreground">По запросу ничего не найдено</Text>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
