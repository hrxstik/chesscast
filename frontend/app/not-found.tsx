import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { H2, Text } from '@/components/ui/typography';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="text-6xl font-black tracking-tighter text-muted-foreground/40 md:text-7xl lg:text-8xl laptop:text-9xl desktop:text-9xl">
        404
      </p>
      <H2 className="text-balance">Страница не найдена</H2>
      <Text className="mx-auto text-muted-foreground">
        Проверьте адрес или вернитесь на главную.
      </Text>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button asChild >
          <Link href="/">На главную</Link>
        </Button>
        <Button asChild variant="outline" >
          <Link href="/pricing">Тарифы</Link>
        </Button>
      </div>
    </div>
  );
}
