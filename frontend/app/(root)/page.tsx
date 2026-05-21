import { Container } from "@/components/shared/container";
import { Section } from "@/components/ui/section";
import { H1, H2, Lead, Text } from "@/components/ui/typography";
import { YouTubeEmbed } from "@/components/shared/youtube-embed";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Brain,
  Camera,
  History,
  Trophy,
  Users,
} from "lucide-react";

export default function RootPage() {
  return (
    <Container>
      {/* Hero */}
      <Section className="pt-6 pb-8 md:pt-10 lg:pt-12 laptop:pt-14">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted/60 via-background to-muted/40 p-6 shadow-sm md:p-8 lg:p-10 laptop:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl laptop:size-80" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative mx-auto max-w-4xl text-center">
            <H1 className="text-balance">
              Добро пожаловать в ChessCast — платформу для анализа физических
              шахматных партий в реальном времени
            </H1>
            <Lead className="mx-auto mt-5 max-w-2xl text-pretty">
              Улучшайте свои навыки в шахматах с помощью анализа партий в
              реальном времени. Наш сервис подходит как новичкам, так и
              профессионалам. ChessCast можно использовать как в личных целях,
              так и для игры в шахматной организации или на турнирах.
            </Lead>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2"
                >
                  Зарегистрироваться и начать играть
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">Смотреть тарифы</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Карточки возможностей */}
      <Section className="py-8 md:py-10 lg:py-12">
        <H2 className="text-center">Возможности платформы</H2>
        <Text className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Стрим, зрительский режим, компьютерное зрение и движок — в одном
          контуре с вашим клубом.
        </Text>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <Card className="border-border/80 transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Camera className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                Камера и стрим
              </h3>
              <Text className="text-muted-foreground">
                Штатив и телефон — запись партии в реальном времени; зрители
                видят доску и контекст игры.
              </Text>
            </CardContent>
          </Card>
          <Card className="border-border/80 transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                Компьютерное зрение
              </h3>
              <Text className="text-muted-foreground">
                Система анализирует положение фигур по видео и передаёт
                состояние партии на сервер для анализа и истории.
              </Text>
            </CardContent>
          </Card>
          <Card className="border-border/80 transition-shadow hover:shadow-md md:col-span-2 lg:col-span-1">
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                История и организации
              </h3>
              <Text className="text-muted-foreground">
                Оцифрованные партии в личной истории, в шахматной организации и
                при просмотре игр других игроков.
              </Text>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Как работает: сетка + видео */}
      <Section className="py-8 md:py-12 lg:py-14">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-12 laptop:gap-14">
          <div className="space-y-6">
            <H2>Как работает ChessCast?</H2>
            <Text className="text-muted-foreground">
              Для анализа партии в реальном времени используется
              интеллектуальная система, которая использует компьютерное зрение,
              чтобы анализировать доску и предсказывать ходы. Для работы нашего
              сервиса вам необходимы штатив и телефон, чтобы записывать партии в
              реальном времени.
            </Text>
            <Text className="text-muted-foreground">
              Запись с камеры телефона передаётся на сервер, где определяется
              текущее положение игры, и с помощью шахматного движка{" "}
              <strong className="text-foreground">Stockfish 17.1</strong>{" "}
              оценивается позиция и подсказываются идеи ходов.
            </Text>
            <Text className="text-muted-foreground">
              Помимо live-анализа вы можете использовать ChessCast для личных
              тренировок и просмотра сохранённых партий — в своей истории, в
              организации или у других игроков.
            </Text>
          </div>
          <Card className="overflow-hidden border-border/80 shadow-sm lg:sticky lg:top-28">
            <CardContent className="p-0">
              <YouTubeEmbed
                videoId="dQw4w9WgXcQ"
                className="aspect-video w-full overflow-hidden border-0"
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Турниры — широкая карточка */}
      <Section className="py-8 md:py-10">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-muted/30">
          <CardContent className="flex flex-col gap-4 pt-8 md:flex-row md:items-center md:gap-8 md:pt-8">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary md:size-16">
              <Trophy className="size-7 md:size-8" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <H2 className="!text-xl md:!text-2xl laptop:!text-3xl">
                Турниры
              </H2>
              <Text className="text-muted-foreground md:text-base">
                Организации могут проводить турниры, записывая сразу несколько
                игр одновременно. ChessCast позволяет следить за несколькими
                играми сразу. Ваша шахматная организация может использовать
                ChessCast на турнирах вместо электронных досок.
              </Text>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
              <Button asChild variant="outline">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2"
                >
                  <Users className="size-4" aria-hidden />
                  Тарифы для клубов
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Финальный CTA */}
      <Section className="pb-16 md:pb-20 lg:pb-24">
        <Card className="mx-auto max-w-3xl border-border text-center shadow-sm">
          <CardContent className="space-y-4 pt-8 md:pt-10">
            <H2>Начать играть</H2>
            <Text className="text-muted-foreground">
              Присоединяйтесь к сообществу, изучайте стратегии, анализируйте
              свои игры, следите за турнирами и развивайте мастерство с
              современными шахматными технологиями.
            </Text>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button asChild>
                <Link href="/register">Зарегистрироваться и начать играть</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Уже есть аккаунт</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>
    </Container>
  );
}
