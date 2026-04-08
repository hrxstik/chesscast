'use client';

import { MyGamesList } from '@/components/dashboard/my-games-list';
import { H2, Text } from '@/components/ui/typography';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Filter, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DashboardGamesPage() {
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [result, setResult] = useState('');
  const [token, setToken] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <div className="space-y-8">
      <div>
        <H2>Мои игры</H2>
        <Text className="mt-2 text-muted-foreground">
          Список с курсорной пагинацией и фильтрами по статусу/режиму.
        </Text>
      </div>

      <Card className="border-border/80 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" aria-hidden />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}>
                <option value="">Все статусы</option>
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="FINISHED">FINISHED</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}>
                <option value="">Все режимы</option>
                <option value="TRAINING">TRAINING</option>
                <option value="COMPETITIVE">COMPETITIVE</option>
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={result}
                onChange={(e) => setResult(e.target.value)}>
                <option value="">Любой исход</option>
                <option value="WHITE_WIN">WHITE_WIN</option>
                <option value="BLACK_WIN">BLACK_WIN</option>
                <option value="DRAW">DRAW</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <input
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                placeholder="Поиск по token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <input
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <input
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <Button asChild className="w-full gap-2 md:w-auto">
            <Link href="/create-game" className="inline-flex items-center gap-2">
              <Plus className="size-4" aria-hidden />
              Новая игра
            </Link>
          </Button>
        </CardContent>
      </Card>

      <MyGamesList
        status={status || undefined}
        mode={mode || undefined}
        result={result || undefined}
        token={token || undefined}
        from={from || undefined}
        to={to || undefined}
      />
    </div>
  );
}
