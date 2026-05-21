'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { submitCreateGame } from '@/lib/create-game-form';
import { ApiError } from '@/lib/api/types';

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Закрытая' },
  { value: 'PUBLIC', label: 'Публичная' },
];

export default function CreateGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = useMemo(() => {
    const raw = searchParams.get('organizationId');
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  }, [searchParams]);
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const game = await submitCreateGame(visibility, organizationId);
      router.push(`/game/watch/${game.token}?viewer=false`);
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
            {organizationId != null
              ? 'Партия будет привязана к выбранной организации.'
              : 'Личная партия. Закрытая — по правилам доступа, публичная — по ссылке.'}
          </Text>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="vis-p" className="text-sm font-medium">
                Видимость
              </label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'PRIVATE' | 'PUBLIC')}
                options={VISIBILITY_OPTIONS}
                aria-label="Видимость партии"
              />
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
