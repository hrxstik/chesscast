"use client";

import { MyGamesList } from "@/components/dashboard/my-games-list";
import {
  GamesFiltersBar,
  type GamesFilterValues,
} from "@/components/dashboard/games-filters";
import { H2 } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { hrefCreateGameModal } from "@/lib/create-game-modal-url";

export default function DashboardGamesPage() {
  const [filters, setFilters] = useState<GamesFilterValues>({
    status: "",
    result: "",
    token: "",
    from: "",
    to: "",
  });

  return (
    <div className="space-y-8">
      <div>
        <H2>Мои игры</H2>
      </div>

      <Card className="border-border/80 bg-muted/20">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-end md:justify-between">
          <GamesFiltersBar
            values={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          />
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
        status={filters.status || undefined}
        result={filters.result || undefined}
        token={filters.token || undefined}
        from={filters.from || undefined}
        to={filters.to || undefined}
      />
    </div>
  );
}
