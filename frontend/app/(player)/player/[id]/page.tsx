'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gamepad2, User, ArrowRight } from 'lucide-react';
import { getPublicUserProfile, type PublicUserProfileResponse } from '@/lib/api/user';
import { ApiError } from '@/lib/api/types';

export default function PlayerPage() {
  const params = useParams();
  const userIdFromUrl = params.id;
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = React.useState<PublicUserProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isOwner = user?.id.toString() === userIdFromUrl;

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getPublicUserProfile(Number(userIdFromUrl));
        setProfile(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить профиль игрока');
      }
    })();
  }, [userIdFromUrl]);

  return (
    <div className="space-y-8">
      <div>
        <Text className="text-sm font-mono text-muted-foreground">ID {userIdFromUrl}</Text>
        <H1 className="mt-1">
          {isOwner ? 'Ваш профиль' : profile ? profile.name : `Профиль игрока ${userIdFromUrl}`}
        </H1>
        <Text className="mt-2 max-w-2xl text-muted-foreground">
          Публичная карточка игрока: организации и недавние партии.
        </Text>
        {error ? <Text className="mt-2 text-sm text-destructive">{error}</Text> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" />
              Об игроке
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="size-24 rounded-full border-2 border-dashed border-border bg-muted/40" />
            <div className="w-full space-y-2">
              <Text className="text-sm font-medium">{profile?.name ?? '—'}</Text>
              <Text className="text-xs text-muted-foreground">
                в системе с {profile ? new Date(profile.createdAt).toLocaleDateString() : '—'}
              </Text>
            </div>
            <div className="w-full space-y-1">
              {profile?.organizations.slice(0, 5).map((o) => (
                <div key={o.id} className="rounded border border-border/70 px-2 py-1 text-xs">
                  {o.name} · {o.role}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="size-4 text-primary" />
              Недавние партии
            </CardTitle>
            {isOwner ? (
              <Button asChild variant="outline" className="gap-2">
                <Link href="/dashboard/games">
                  Все игры
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {(profile?.recentGames ?? []).map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                <div className="text-xs font-mono">{g.token.slice(0, 10)}…</div>
                <div className="text-xs text-muted-foreground">
                  {g.mode} · {g.status}
                </div>
              </div>
            ))}
            {(profile?.recentGames.length ?? 0) === 0 ? (
              <Text className="pt-2 text-center text-sm text-muted-foreground">Недавних партий нет</Text>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
