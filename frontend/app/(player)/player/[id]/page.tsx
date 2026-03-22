'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserStore } from '@/store/user';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gamepad2, User, ArrowRight } from 'lucide-react';

export default function PlayerPage() {
  const params = useParams();
  const userIdFromUrl = params.id;
  const user = useUserStore((state) => state.user);

  const isOwner = user?.id.toString() === userIdFromUrl;

  return (
    <div className="space-y-8">
      <div>
        <Text className="text-sm font-mono text-muted-foreground">ID {userIdFromUrl}</Text>
        <H1 className="mt-1">
          {isOwner ? 'Ваш профиль' : `Профиль игрока ${userIdFromUrl}`}
        </H1>
        <Text className="mt-2 max-w-2xl text-muted-foreground">
          Публичная карточка игрока: рейтинг, организации и недавние партии — после подключения API.
        </Text>
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
              <div className="mx-auto h-5 w-40 rounded bg-muted" />
              <div className="mx-auto h-4 w-32 rounded bg-muted/70" />
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
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                <div className="h-4 w-36 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted/80" />
              </div>
            ))}
            <Text className="pt-2 text-center text-sm text-muted-foreground">
              Заглушка списка игр
            </Text>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
