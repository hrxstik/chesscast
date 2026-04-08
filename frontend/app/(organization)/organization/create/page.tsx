'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Section } from '@/components/ui/section';
import { H1, Lead, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createOrganization } from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const org = await createOrganization({ name, description });
      router.push(`/organization/${org.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать организацию');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section>
      <Button asChild variant="ghost" className="-ml-2 mb-6 gap-2 text-muted-foreground">
        <Link href="/dashboard/organizations">
          <ArrowLeft className="size-4" aria-hidden />
          К организациям
        </Link>
      </Button>

      <H1>Создать организацию</H1>
      <Lead className="mt-2 max-w-2xl">
        Название и описание. Проверка лимитов подписки выполняется на сервере.
      </Lead>

      <Card className="mt-10 max-w-xl border-border/80">
        <CardHeader>
          <CardTitle>Данные организации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Название
              </Text>
              <input
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Описание
              </Text>
              <textarea
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание…' : 'Создать организацию'}
              </Button>
              <Button asChild variant="outline" type="button">
                <Link href="/dashboard/organizations">Отмена</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Section>
  );
}
