import { MyGamesList } from '@/components/dashboard/my-games-list';
import { H2, Text } from '@/components/ui/typography';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Filter, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardGamesPage() {
  return (
    <div className="space-y-8">
      <div>
        <H2>Мои игры</H2>
        <Text className="mt-2 text-muted-foreground">
          Список с курсорной пагинацией на бэке. Фильтры и виртуализация — следующими итерациями.
        </Text>
      </div>

      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" disabled aria-disabled>
              <Filter className="size-4" aria-hidden />
              Фильтры
            </Button>
            <Text className="text-sm text-muted-foreground">Скоро: статус, режим, дата</Text>
          </div>
          <Button asChild className="w-full gap-2 md:w-auto">
            <Link href="/create-game" className="inline-flex items-center gap-2">
              <Plus className="size-4" aria-hidden />
              Новая игра
            </Link>
          </Button>
        </CardContent>
      </Card>

      <MyGamesList />
    </div>
  );
}
