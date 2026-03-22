import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Gamepad2, Settings, Users } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

export default async function OrganizationPage({ params }: Props) {
  const { id } = await params;

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Text className="text-sm font-mono text-muted-foreground">ID {id}</Text>
          <H1 className="mt-1">Организация</H1>
          <Text className="mt-2 max-w-2xl text-muted-foreground">
            Обзор клуба: участники, игры и быстрые действия. Название и метаданные — с API.
          </Text>
        </div>
        <Button asChild variant="outline" className="w-full shrink-0 gap-2 md:w-auto">
          <Link href={`/organization/${id}/settings`}>
            <Settings className="size-4" aria-hidden />
            Настройки
          </Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Участники
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Список с ролями (игрок / админ организации), приглашения.
            </Text>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-6 w-16 rounded bg-muted/80" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="size-5 text-primary" />
              Игры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Партии организации с фильтрами по статусу и режиму.
            </Text>
            <div className="h-32 rounded-lg border border-dashed border-border bg-muted/10" />
            <Button variant="secondary" className="w-full" disabled>
              Все игры организации
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
