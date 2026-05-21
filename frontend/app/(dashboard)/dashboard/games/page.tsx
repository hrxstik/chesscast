"use client";

import { MyGamesList } from "@/components/dashboard/my-games-list";
import { H2, Text } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Filter, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { hrefCreateGameModal } from "@/lib/create-game-modal-url";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "PENDING", label: "Ожидает начала" },
  { value: "IN_PROGRESS", label: "Идёт трансляция" },
  { value: "FINISHED", label: "Завершена" },
];

const RESULT_OPTIONS = [
  { value: "", label: "Любой исход" },
  { value: "WHITE_WIN", label: "Победа белых" },
  { value: "BLACK_WIN", label: "Победа чёрных" },
  { value: "DRAW", label: "Ничья" },
  { value: "CANCELLED", label: "Отменена" },
  { value: "WHITE_RESIGN", label: "Сдались белые" },
  { value: "BLACK_RESIGN", label: "Сдались чёрные" },
];

export default function DashboardGamesPage() {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [token, setToken] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <H2>Мои игры</H2>
      </div>

      <Card className="border-border/80 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Filter
              className="mb-2 size-4 text-muted-foreground md:mb-0"
              aria-hidden
            />
            <Select
              value={status}
              onValueChange={setStatus}
              options={STATUS_OPTIONS}
              placeholder="Статус"
              aria-label="Фильтр по статусу"
            />
            <Select
              value={result}
              onValueChange={setResult}
              options={RESULT_OPTIONS}
              placeholder="Исход"
              aria-label="Фильтр по исходу"
            />
            <input
              className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm shadow-xs"
              placeholder="Токен"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <input
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Дата с"
            />
            <input
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Дата по"
            />
          </div>
          <Button asChild className="w-full gap-2 md:w-auto">
            <Link
              href={hrefCreateGameModal()}
              className="inline-flex items-center gap-2"
            >
              <Plus className="size-4" aria-hidden />
              Новая игра
            </Link>
          </Button>
        </CardContent>
      </Card>

      <MyGamesList
        status={status || undefined}
        result={result || undefined}
        token={token || undefined}
        from={from || undefined}
        to={to || undefined}
      />
    </div>
  );
}
