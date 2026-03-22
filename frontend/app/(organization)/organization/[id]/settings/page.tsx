import { Section } from '@/components/ui/section';
import { H1, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrgSubNav } from '@/components/organization/org-sub-nav';
import { Button } from '@/components/ui/button';
import { KeyRound, SlidersHorizontal } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

export default async function OrganizationSettingsPage({ params }: Props) {
  const { id } = await params;

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <H1>Настройки организации</H1>
      <Text className="mt-2 text-muted-foreground">
        Управление доступно администратору организации. ID: <span className="font-mono">{id}</span>
      </Text>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="size-4 text-primary" />
              Профиль клуба
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase text-muted-foreground">Название</Text>
              <div className="h-10 rounded-md border border-dashed border-border bg-muted/20" />
            </div>
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase text-muted-foreground">Описание</Text>
              <div className="h-20 rounded-md border border-dashed border-border bg-muted/20" />
            </div>
            <Button disabled>Сохранить</Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" />
              Приглашения
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-sm text-muted-foreground">
              Invite-код и ссылка для вступления. Регенерация при компрометации.
            </Text>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm">
              <span className="flex-1 truncate text-muted-foreground">••••••••</span>
              <Button variant="outline" className="!min-h-8 shrink-0 px-3 text-xs" disabled>
                Копировать
              </Button>
            </div>
            <Button variant="secondary" disabled>
              Сгенерировать новый код
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
