'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { H1, Text } from '@/components/ui/typography';
import {
  fetchMyOrganizationMembership,
  fetchOrganization,
  joinOpenOrganization,
} from '@/lib/api/organizations';
import { labelJoinPolicy } from '@/lib/game-labels';
import toast from 'react-hot-toast';

type Props = {
  orgId: string;
  children: React.ReactNode;
};

export function OrganizationMemberGate({ orgId, children }: Props) {
  const router = useRouter();
  const numericId = Number(orgId);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinPolicy, setJoinPolicy] = useState('');
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || Number.isNaN(numericId)) return;
    setLoading(true);
    try {
      const [org, membership] = await Promise.all([
        fetchOrganization(numericId),
        fetchMyOrganizationMembership(numericId),
      ]);
      setName(org.name);
      setDescription(org.description ?? '');
      setJoinPolicy(org.joinPolicy ?? '');
      if (membership.isMember) {
        setIsMember(true);
        setGuestOpen(false);
      } else if (org.joinPolicy === 'OPEN') {
        setIsMember(false);
        setGuestOpen(true);
      } else {
        setIsMember(false);
        setGuestOpen(false);
      }
    } catch {
      setIsMember(false);
      setGuestOpen(false);
    } finally {
      setLoading(false);
    }
  }, [orgId, numericId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onJoin() {
    setJoining(true);
    try {
      await joinOpenOrganization(numericId);
      toast.success('Вы вступили в организацию');
      await load();
      router.refresh();
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <Text className="text-muted-foreground">Загрузка…</Text>;
  }

  if (isMember) {
    return <>{children}</>;
  }

  if (guestOpen) {
    return (
      <Card className="max-w-xl border-border/80">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <Text className="text-sm text-muted-foreground">
            Открытый клуб · {labelJoinPolicy('OPEN')}
          </Text>
        </CardHeader>
        <CardContent className="space-y-4">
          {description ? (
            <Text className="text-sm text-muted-foreground">{description}</Text>
          ) : null}
          <Text className="text-sm text-muted-foreground">
            Вы ещё не участник. Вступите, чтобы видеть участников, игры и настройки
            клуба.
          </Text>
          <Button onClick={() => void onJoin()} disabled={joining}>
            {joining ? 'Вступление…' : 'Вступить в организацию'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <H1>Организация недоступна</H1>
      <Text className="text-muted-foreground">
        Клуб не найден или доступен только по приглашению. Вступите по коду на странице
        «Организации» в личном кабинете.
      </Text>
    </div>
  );
}
