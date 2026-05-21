'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Section } from '@/components/ui/section';
import { H1, Lead, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  createOrganization,
  fetchOrganizationCreateEligibility,
  type OrganizationCreateEligibilityDto,
} from '@/lib/api/organizations';
import toast from 'react-hot-toast';

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eligibility, setEligibility] =
    useState<OrganizationCreateEligibilityDto | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const elig = await fetchOrganizationCreateEligibility();
        setEligibility(elig);
      } catch {
        /* toast из apiFetch */
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eligibility?.canCreate) return;
    setLoading(true);
    try {
      const org = await createOrganization({ name, description });
      toast.success('Организация создана');
      router.push(`/organization/${org.id}`);
    } finally {
      setLoading(false);
    }
  }

  const canCreate = eligibility?.canCreate ?? false;

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
        Название и описание. Создание доступно по тарифу и в пределах лимита организаций,
        где вы администратор.
      </Lead>

      {checking ? (
        <Text className="mt-6 text-muted-foreground">Проверка тарифа…</Text>
      ) : (
        <Card className="mt-10 max-w-xl border-border/80">
          <CardHeader>
            <CardTitle>Данные организации</CardTitle>
            {eligibility && canCreate ? (
              <Text className="text-sm font-normal text-muted-foreground">
                Осталось слотов:{' '}
                {eligibility.maxOrganizations - eligibility.adminOrganizationsCount} из{' '}
                {eligibility.maxOrganizations}
                {eligibility.planTitle ? ` (тариф «${eligibility.planTitle}»)` : ''}
              </Text>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {!canCreate ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <Text className="text-sm text-muted-foreground">
                  {eligibility?.message ??
                    'Создание организации недоступно на текущем тарифе.'}
                </Text>
                <Button asChild variant="outline" size="sm">
                  <Link href="/pricing">Посмотреть тарифы</Link>
                </Button>
              </div>
            ) : (
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
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Создание…' : 'Создать организацию'}
                  </Button>
                  <Button asChild variant="outline" type="button">
                    <Link href="/dashboard/organizations">Отмена</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </Section>
  );
}
