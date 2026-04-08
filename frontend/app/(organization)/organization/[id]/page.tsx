'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Gamepad2, Settings, Users } from 'lucide-react';
import {
  fetchOrganization,
  fetchOrganizationGames,
  fetchOrganizationMembers,
  fetchOrganizationStatus,
  type OrganizationGameDto,
  type OrganizationMemberDto,
} from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';

type Props = { params: Promise<{ id: string }> };

export default function OrganizationPage({ params }: Props) {
  const [id, setId] = useState<string>('');
  const [name, setName] = useState('Организация');
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [games, setGames] = useState<OrganizationGameDto[]>([]);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await params;
      setId(p.id);
      const orgId = Number(p.id);
      try {
        const [org, m, g, st] = await Promise.all([
          fetchOrganization(orgId),
          fetchOrganizationMembers(orgId),
          fetchOrganizationGames(orgId, {
            status: statusFilter || undefined,
            mode: modeFilter || undefined,
          }),
          fetchOrganizationStatus(orgId),
        ]);
        setName(org.name);
        setMembers(m);
        setGames(g);
        setIsActive(st.isActive);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить организацию');
      }
    })();
  }, [params, statusFilter, modeFilter]);

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Text className="text-sm font-mono text-muted-foreground">ID {id}</Text>
          <H1 className="mt-1">{name}</H1>
          <Text className="mt-2 max-w-2xl text-muted-foreground">
            Обзор клуба: участники, игры и быстрые действия.
          </Text>
          {isActive !== null ? (
            <Text className="mt-1 text-sm text-muted-foreground">
              Статус: {isActive ? 'активна' : 'неактивна'}
            </Text>
          ) : null}
        </div>
        <Button asChild variant="outline" className="w-full shrink-0 gap-2 md:w-auto">
          <Link href={`/organization/${id}/settings`}>
            <Settings className="size-4" aria-hidden />
            Настройки
          </Link>
        </Button>
      </div>
      {error ? <Text className="mt-4 text-sm text-destructive">{error}</Text> : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Участники
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Список с ролями (игрок / админ организации), приглашения.
            </Text>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="text-sm">{m.user.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
              ))}
              {members.length === 0 ? (
                <Text className="text-xs text-muted-foreground">Нет участников</Text>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="size-5 text-primary" />
              Игры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Партии организации с фильтрами по статусу и режиму.
            </Text>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Все статусы</option>
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="FINISHED">FINISHED</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}>
                <option value="">Все режимы</option>
                <option value="TRAINING">TRAINING</option>
                <option value="COMPETITIVE">COMPETITIVE</option>
              </select>
            </div>
            <div className="space-y-2">
              {games.slice(0, 5).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="text-sm font-mono">{g.token.slice(0, 10)}…</div>
                  <div className="text-xs text-muted-foreground">
                    {g.mode} · {g.status}
                  </div>
                </div>
              ))}
            </div>
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/dashboard/games`}>Все игры организации</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
