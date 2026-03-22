'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { createGame } from '@/lib/api/games';
import { ApiError } from '@/lib/api/types';

export default function CreateGameModalPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'TRAINING' | 'COMPETITIVE'>('TRAINING');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const game = await createGame({ mode, visibility });
      router.push(`/game/${game.token}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать игру');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <Card className="relative w-full max-w-lg border-border/80 shadow-lg">
        <Button
          asChild
          variant="ghost"
          className="absolute right-2 top-2 !h-9 !min-h-9 !w-9 !min-w-9 !p-0"
          aria-label="Закрыть">
          <Link href="/dashboard">
            <X className="size-4" />
          </Link>
        </Button>
        <CardHeader className="pr-12">
          <CardTitle>Создать игру</CardTitle>
          <Text className="text-sm font-normal text-muted-foreground">
            Режим и видимость сохраняются в БД (POST /game).
          </Text>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="mode" className="text-sm font-medium">
                Режим
              </label>
              <select
                id="mode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'TRAINING' | 'COMPETITIVE')}>
                <option value="TRAINING">Тренировка</option>
                <option value="COMPETITIVE">Соревновательный</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="visibility" className="text-sm font-medium">
                Видимость
              </label>
              <select
                id="visibility"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'PUBLIC')}>
                <option value="PRIVATE">Приватная (только вы, игроки и участники орги)</option>
                <option value="PUBLIC">Публичная (любой по ссылке)</option>
              </select>
            </div>
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание…' : 'Создать'}
              </Button>
              <Button asChild variant="outline" type="button">
                <Link href="/dashboard">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
