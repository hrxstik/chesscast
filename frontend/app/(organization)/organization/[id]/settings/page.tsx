'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import { KeyRound, SlidersHorizontal } from 'lucide-react';
import {
  deleteOrganization,
  fetchOrganization,
  fetchOrganizationMembers,
  removeOrganizationMember,
  recreateOrganizationInviteCode,
  updateOrganization,
  type OrganizationMemberDto,
} from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';
import { useRouter } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default function OrganizationSettingsPage({ params }: Props) {
  const router = useRouter();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await params;
      setId(p.id);
      try {
        const org = await fetchOrganization(Number(p.id));
        const orgMembers = await fetchOrganizationMembers(Number(p.id));
        setName(org.name);
        setDescription(org.description);
        setInviteCode(org.inviteCode);
        setMembers(orgMembers);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить организацию');
      }
    })();
  }, [params]);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await updateOrganization(Number(id), { name, description });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  async function onRecreateCode() {
    setSaving(true);
    setError(null);
    try {
      const res = await recreateOrganizationInviteCode(Number(id));
      setInviteCode(res.inviteCode);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить invite-код');
    } finally {
      setSaving(false);
    }
  }

  async function onCopyInviteCode() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
    } catch {
      // Ignore clipboard errors in unsupported environments.
    }
  }

  async function onDeleteOrganization() {
    setSaving(true);
    setError(null);
    try {
      await deleteOrganization(Number(id));
      router.push('/dashboard/organizations');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить организацию');
    } finally {
      setSaving(false);
    }
  }

  async function reloadMembers() {
    try {
      const rows = await fetchOrganizationMembers(Number(id));
      setMembers(rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить список участников');
    }
  }

  async function onRemoveMember(member: OrganizationMemberDto) {
    setSaving(true);
    setError(null);
    try {
      await removeOrganizationMember(Number(id), member.userId);
      await reloadMembers();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить участника');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <H1>Настройки организации</H1>
      <Text className="mt-2 text-muted-foreground">
        Управление доступно администратору организации. ID: <span className="font-mono">{id}</span>
      </Text>
      {error ? <Text className="mt-2 text-sm text-destructive">{error}</Text> : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="size-4 text-primary" />
              Профиль клуба
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase text-muted-foreground">Название</Text>
              <input
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase text-muted-foreground">Описание</Text>
              <textarea
                className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" />
              Приглашения
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-sm text-muted-foreground">
              Invite-код и ссылка для вступления. Регенерация при компрометации.
            </Text>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm">
              <span className="flex-1 truncate text-muted-foreground">{inviteCode || '—'}</span>
              <Button
                variant="outline"
                className="!min-h-8 shrink-0 px-3 text-xs"
                onClick={() => void onCopyInviteCode()}>
                Копировать
              </Button>
            </div>
            <Button variant="secondary" onClick={() => void onRecreateCode()} disabled={saving}>
              {saving ? 'Генерация…' : 'Сгенерировать новый код'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Участники организации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <Text className="text-sm">{m.user.name}</Text>
              <Text className="text-xs text-muted-foreground">{m.user.email}</Text>
              <Text className="text-xs text-muted-foreground">Роль: {m.role}</Text>
              <Button
                className="ml-auto h-8 text-xs"
                variant="destructive"
                onClick={() => void onRemoveMember(m)}
                disabled={saving || m.role === 'ADMIN'}>
                Исключить
              </Button>
            </div>
          ))}
          {members.length === 0 ? (
            <Text className="text-sm text-muted-foreground">Участники не найдены.</Text>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-6 border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Опасная зона</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="mb-3 text-sm text-muted-foreground">
            Удаление организации выполняется мягко: игры и история сохраняются, но карточка организации скрывается.
          </Text>
          <Button variant="destructive" disabled={saving} onClick={() => void onDeleteOrganization()}>
            Удалить организацию
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}
