import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, Lead, Text } from '@/components/ui/typography';
import { Building2, Hash, Mail, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardOrganizationsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <H2>Организации</H2>
          <Lead className="mt-2 max-w-2xl">
            Клубы, в которые вы входите, и приглашения по коду. Управление для админа организации —
            из карточки организации.
          </Lead>
        </div>
        <Button asChild className="w-full shrink-0 gap-2 md:w-auto">
          <Link href="/organization/create">
            <Plus className="size-4" aria-hidden />
            Создать организацию
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Список организаций</CardTitle>
              <Text className="text-sm text-muted-foreground">Данные с API</Text>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
              </div>
            ))}
            <Text className="pt-2 text-center text-sm text-muted-foreground">
              Заглушка: здесь будут карточки клубов с ролью и кнопкой «Открыть».
            </Text>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="size-4 text-primary" aria-hidden />
              Вступить по коду
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-sm text-muted-foreground">
              Введите invite-код организации — подключим к эндпоинту вступления.
            </Text>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="h-11 flex-1 rounded-md border border-dashed border-border bg-muted/20" />
              <Button disabled className="sm:shrink-0">
                Вступить
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm text-muted-foreground">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              Приглашения по ссылке и email — позже.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
