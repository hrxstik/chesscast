'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { X } from 'lucide-react';
import { submitCreateGame } from '@/lib/create-game-form';
import { ApiError } from '@/lib/api/types';

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Закрытая' },
  { value: 'PUBLIC', label: 'Публичная' },
];

export default function CreateGameModalPage() {
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
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="visibility" className="text-sm font-medium">
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
                <Link href="/dashboard">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
