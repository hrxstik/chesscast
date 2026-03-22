import { Section } from '@/components/ui/section';
import { H1, Lead, Text } from '@/components/ui/typography';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateOrganizationPage() {
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
        Название, описание, аватар и лимиты по тарифу — отправка на POST организации после согласования
        DTO.
      </Lead>

      <Card className="mt-10 max-w-xl border-border/80">
        <CardHeader>
          <CardTitle>Данные организации</CardTitle>
          <Text className="text-sm text-muted-foreground">Черновик полей формы</Text>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Название
            </Text>
            <div className="h-11 rounded-md border border-dashed border-border bg-muted/20" />
          </div>
          <div className="space-y-2">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Описание
            </Text>
            <div className="h-24 rounded-md border border-dashed border-border bg-muted/20" />
          </div>
          <div className="space-y-2">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Аватар
            </Text>
            <div className="flex items-center gap-3">
              <div className="size-14 rounded-lg border border-dashed border-border bg-muted/30" />
              <Button variant="outline" disabled>
                Выбрать файл
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button disabled>Создать организацию</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/organizations">Отмена</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}
