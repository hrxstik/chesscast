'use client';

import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PricingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <Text className="font-semibold">Не удалось загрузить тарифы</Text>
      <Text className="text-muted-foreground">{error.message}</Text>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Повторить
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
