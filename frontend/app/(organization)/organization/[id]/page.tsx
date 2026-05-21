'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Gamepad2, Plus, Settings, Users } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { GameListCard } from '@/components/dashboard/game-list-card';
import {
  fetchOrganization,
  fetchOrganizationGames,
  fetchOrganizationMembers,
  fetchOrganizationStatus,
  type OrganizationGameDto,
  type OrganizationMemberDto,
} from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';
import { useAuthStore } from '@/store/auth-store';

type Props = { params: Promise<{ id: string }> };

export default function OrganizationPage({ params }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [id, setId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState('Организация');
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [games, setGames] = useState<OrganizationGameDto[]>([]);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
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
          }),
          fetchOrganizationStatus(orgId),
        ]);
        setName(org.name);
        setMembers(m);
        setGames(g);
        setIsActive(st.isActive);
        if (userId != null) {
          setIsAdmin(m.some((x) => x.userId === userId && x.role === 'ADMIN'));
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить организацию');
      }
    })();
  }, [params, statusFilter, userId]);

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
              Партии организации. Фильтр по статусу.
            </Text>
            {isAdmin ? (
              <Button asChild className="w-full gap-2">
                <Link href={`/create-game?organizationId=${id}`}>
                  <Plus className="size-4" aria-hidden />
                  Новая игра в организации
                </Link>
              </Button>
            ) : null}
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: '', label: 'Все статусы' },
                { value: 'PENDING', label: 'Ожидает начала' },
                { value: 'IN_PROGRESS', label: 'Идёт трансляция' },
                { value: 'FINISHED', label: 'Завершена' },
              ]}
              aria-label="Статус партии"
            />
            <div className="space-y-2">
              {games.slice(0, 8).map((g) => (
                <GameListCard key={g.id} game={g} />
              ))}
            </div>
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/organization/${id}/games`}>Все игры организации</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
