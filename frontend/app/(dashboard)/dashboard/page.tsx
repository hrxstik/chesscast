"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Lead, Text } from "@/components/ui/typography";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Gamepad2, Building2, User, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  type DashboardSummaryResponse,
} from "@/lib/api/user";
import { ApiError } from "@/lib/api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSummary(await getDashboardSummary());
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "Не удалось загрузить сводку",
        );
      }
    })();
  }, []);

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/50 via-background to-background p-6 md:p-8">
        <H2 className="mt-4">Личный кабинет</H2>
        <Lead className="mt-2 max-w-2xl">Обзор аккаунта</Lead>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Игры: {summary?.gamesCount ?? "—"}</span>
          <span>Организации: {summary?.organizationsCount ?? "—"}</span>
          <span>Подписка: {summary?.subscription?.plan.title ?? "нет"}</span>
        </div>
        {error ? (
          <Text className="mt-2 text-sm text-destructive">{error}</Text>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 laptop:grid-cols-3">
        <Card className="border-border/80 transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Gamepad2 className="size-5 shrink-0 text-primary" />
              Игры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-muted-foreground">
              Список партий, просмотр и проведение трансляций.
            </Text>
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link
                href="/dashboard/games"
                className="inline-flex items-center gap-2"
              >
                Открыть игры
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Building2 className="size-5 shrink-0 text-primary" />
              Организации
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-muted-foreground">
              Клубы, приглашения и турниры.
            </Text>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link
                  href="/dashboard/organizations"
                  className="inline-flex items-center gap-2"
                >
                  Мои организации
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/organization/create">Создать</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 transition-shadow hover:shadow-md md:col-span-2 laptop:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <User className="size-5 shrink-0 text-primary" />
              Профиль
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Text className="text-muted-foreground">
              Единое место для настроек аккаунта.
            </Text>
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2"
              >
                Редактировать профиль
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
