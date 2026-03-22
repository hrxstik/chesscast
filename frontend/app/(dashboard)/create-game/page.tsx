'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { createGame } from '@/lib/api/games';
import { ApiError } from '@/lib/api/types';

export default function CreateGamePage() {
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
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Создать игру</CardTitle>
          <Text className="text-sm font-normal text-muted-foreground">
            Режим и видимость (п.4 ТЗ): приватная — только создатель, игроки и участники организации.
          </Text>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="mode-p" className="text-sm font-medium">
                Режим
              </label>
              <select
                id="mode-p"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'TRAINING' | 'COMPETITIVE')}>
                <option value="TRAINING">Тренировка</option>
                <option value="COMPETITIVE">Соревновательный</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="vis-p" className="text-sm font-medium">
                Видимость
              </label>
              <select
                id="vis-p"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'PUBLIC')}>
                <option value="PRIVATE">Приватная</option>
                <option value="PUBLIC">Публичная</option>
              </select>
            </div>
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание…' : 'Создать'}
              </Button>
              <Button asChild variant="outline" type="button">
                <Link href="/dashboard/games">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
