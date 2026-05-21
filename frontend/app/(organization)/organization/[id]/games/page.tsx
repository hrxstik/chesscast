"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { H1, Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgSubNav } from "@/components/organization/org-sub-nav";
import { OrganizationGamesList } from "@/components/organization/organization-games-list";
import {
  GamesFiltersBar,
  type GamesFilterValues,
} from "@/components/dashboard/games-filters";
import {
  fetchMyOrganizationMembership,
  fetchOrganization,
} from "@/lib/api/organizations";
import { hrefCreateGameModal } from "@/lib/create-game-modal-url";

type Props = { params: Promise<{ id: string }> };

export default function OrganizationGamesPage({ params }: Props) {
  const [orgId, setOrgId] = useState<number | null>(null);
  const [name, setName] = useState("Организация");
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState<GamesFilterValues>({
    status: "",
    result: "",
    token: "",
    from: "",
    to: "",
  });

  useEffect(() => {
    (async () => {
      const p = await params;
      const id = Number(p.id);
      if (Number.isNaN(id)) return;
      setOrgId(id);
      try {
        const [org, membership] = await Promise.all([
          fetchOrganization(id),
          fetchMyOrganizationMembership(id),
        ]);
        setName(org.name);
        setIsAdmin(membership.isAdmin);
      } catch {
        /* toast из apiFetch */
      }
    })();
  }, [params]);

  return (
    <>
      <OrgSubNav orgId={String(orgId ?? "")} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Text className="text-sm text-muted-foreground">
            <Link href={`/organization/${orgId}`} className="hover:underline">
              ← {name}
            </Link>
          </Text>
          <H1 className="mt-2">Игры организации</H1>
        </div>
        {isAdmin && orgId != null ? (
          <Button asChild className="w-full gap-2 md:w-auto">
            <Link href={`/organization/${orgId}${hrefCreateGameModal(orgId)}`}>
              <Plus className="size-4" aria-hidden />
              Новая игра
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="mt-8 border-border/80 bg-muted/20">
        <CardContent className="pt-6">
          <GamesFiltersBar
            values={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          />
        </CardContent>
      </Card>

      {orgId != null ? (
        <div className="mt-6">
          <OrganizationGamesList
            organizationId={orgId}
            status={filters.status || undefined}
            result={filters.result || undefined}
            token={filters.token || undefined}
            from={filters.from || undefined}
            to={filters.to || undefined}
            title="Нет партий в организации"
            emptyHint="Администратор организации может создать первую игру."
          />
        </div>
      ) : null}
    </>
  );
}
