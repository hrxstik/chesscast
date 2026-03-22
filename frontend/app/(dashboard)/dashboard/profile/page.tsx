import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, Text } from '@/components/ui/typography';
import { User, CreditCard, Shield, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardProfilePage() {
  return (
    <div className="space-y-8">
      <div>
        <H2>Профиль</H2>
        <Text className="mt-2 max-w-2xl text-muted-foreground">
          Данные аккаунта и подписка. Формы сохранения подключим к PATCH user и биллингу.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" aria-hidden />
              Основное
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Имя
                </Text>
                <div className="h-10 rounded-md border border-dashed border-border bg-muted/20" />
              </div>
              <div className="space-y-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </Text>
                <div className="h-10 rounded-md border border-dashed border-border bg-muted/20" />
              </div>
            </div>
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Аватар
              </Text>
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-full border border-dashed border-border bg-muted/30" />
                <Button variant="outline" disabled>
                  Загрузить
                </Button>
              </div>
            </div>
            <Button disabled>Сохранить изменения</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" aria-hidden />
                Подписка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Text className="text-sm font-medium">Текущий план</Text>
              <div className="h-8 rounded-md bg-muted/40" />
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/pricing">Сменить тариф</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4 text-primary" aria-hidden />
                Уведомления
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-sm text-muted-foreground">Настройки уведомлений — позже.</Text>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <Shield className="size-4" aria-hidden />
                Опасная зона
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Text className="text-sm text-muted-foreground">Удаление аккаунта и экспорт данных.</Text>
              <Button variant="destructive" disabled>
                Удалить аккаунт
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
