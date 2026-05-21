"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/section";
import { H1, Text } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgSubNav } from "@/components/organization/org-sub-nav";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Gamepad2, Plus, Settings, Users } from "lucide-react";
import { Select } from "@/components/ui/select";
import { GameListCard } from "@/components/dashboard/game-list-card";
import {
  fetchMyOrganizationMembership,
  fetchOrganization,
  fetchOrganizationGames,
  fetchOrganizationMembers,
  fetchOrganizationStatus,
  type OrganizationGameDto,
  type OrganizationMemberDto,
} from "@/lib/api/organizations";
import { hrefCreateGameModal } from "@/lib/create-game-modal-url";
import { labelOrgRole } from "@/lib/game-labels";
type Props = { params: Promise<{ id: string }> };

export default function OrganizationPage({ params }: Props) {
  const [id, setId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState("Организация");
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [games, setGames] = useState<OrganizationGameDto[]>([]);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    (async () => {
      const p = await params;
      setId(p.id);
      const orgId = Number(p.id);
      try {
        const [org, m, g, st, membership] = await Promise.all([
          fetchOrganization(orgId),
          fetchOrganizationMembers(orgId),
          fetchOrganizationGames(orgId, {
            status: statusFilter || undefined,
          }),
          fetchOrganizationStatus(orgId),
          fetchMyOrganizationMembership(orgId),
        ]);
        setName(org.name);
        setMembers(m);
        setGames(g);
        setIsActive(st.isActive);
        setIsAdmin(membership.isAdmin);
      } catch {
        /* toast из apiFetch */
      }
    })();
  }, [params, statusFilter]);

  return (
    <Section>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Text className="text-sm font-mono text-muted-foreground">
            ID {id}
          </Text>
          <H1 className="mt-1">{name}</H1>
          <Text className="mt-2 max-w-2xl text-muted-foreground">
            Обзор клуба
          </Text>
        </div>
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Участники
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
                >
                  <Link
                    href={`/player/${m.userId}`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {m.user.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {labelOrgRole(m.role)}
                  </div>
                </div>
              ))}
              {members.length === 0 ? (
                <Text className="text-xs text-muted-foreground">
                  Нет участников
                </Text>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="size-5 text-primary" />
              Игры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Партии организации.
            </Text>
            {isAdmin ? (
              <Button asChild className="w-full gap-2">
                <Link
                  href={`/organization/${id}${hrefCreateGameModal(Number(id))}`}
                >
                  <Plus className="size-4" aria-hidden />
                  Новая игра в организации
                </Link>
              </Button>
            ) : null}
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "", label: "Все статусы" },
                { value: "PENDING", label: "Ожидает начала" },
                { value: "IN_PROGRESS", label: "Идёт трансляция" },
                { value: "FINISHED", label: "Завершена" },
              ]}
              aria-label="Статус партии"
            />
            <div className="space-y-2">
              {games.slice(0, 8).map((g) => (
                <GameListCard key={g.id} game={g} />
              ))}
            </div>
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/organization/${id}/games`}>
                Все игры организации
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
