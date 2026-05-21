import { PlanCard } from "@/components/shared/plan-card";
import { Container } from "@/components/shared/container";
import { Section } from "@/components/ui/section";
import { H1, H2, Lead, Text } from "@/components/ui/typography";
import { fetchPlans, type PlanDto } from "@/lib/api/plans";
import { freePlanFaqLines } from "@/lib/plan-public-copy";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import Link from "next/link";

export default async function PricingPage() {
  const plans: PlanDto[] = await fetchPlans();
  const freePlan = plans.find((p) => p.code === "FREE");
  const freeFaq = freePlan ? freePlanFaqLines(freePlan) : [];

  return (
    <Container>
      <Section className="min-h-[50vh] pt-8">
        <div className="w-full text-center">
          <H1 className="text-balance">Тарифы ChessCast</H1>
          <Lead className="mx-auto mt-4 max-w-2xl">
            Личные планы и корпоративные лимиты для клубов. Оплата платных
            тарифов — через ЮKassa (тестовый магазин и тестовые карты в личном
            кабинете ЮKassa).
          </Lead>
        </div>
        <div className="mt-12 grid gap-8 laptop:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              planId={plan.id}
              planCode={plan.code}
              title={plan.title}
              price={plan.price}
              description={plan.description}
              features={plan.features}
            />
          ))}
        </div>
      </Section>

      <Section className="pb-20">
        <H2 className="text-center">Частые вопросы</H2>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          <Card className="border-border/80">
            <CardContent className="pt-6">
              <Text className="font-semibold">Можно ли сменить тариф?</Text>
              <Text className="mt-2 text-sm text-muted-foreground">
                Да — оформление платного тарифа со страницы тарифов; смена
                тарифа при необходимости возможна в личном кабинете.
              </Text>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="pt-6">
              <Text className="font-semibold">Что с бесплатным планом?</Text>
              {freeFaq.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {freeFaq.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <Text className="mt-2 text-sm text-muted-foreground">
                  Лимиты бесплатного тарифа задаются в настройках планов на
                  сервере.
                </Text>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/80 md:col-span-2">
            <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
              <div>
                <Text className="font-semibold">
                  Нужна консультация для клуба?
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Напишите на support@chesscast.com — подберём лимиты участников
                  и партий.
                </Text>
              </div>
              <Link
                href="/register"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Создать аккаунт
              </Link>
            </CardContent>
          </Card>
        </div>
      </Section>
    </Container>
  );
}
