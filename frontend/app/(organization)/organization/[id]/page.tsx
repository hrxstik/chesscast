"use client";

import { useEffect, useState } from "react";
import { H1, Text } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgSubNav } from "@/components/organization/org-sub-nav";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Gamepad2, Plus, Users } from "lucide-react";
import { OrganizationGamesList } from "@/components/organization/organization-games-list";
import {
  GamesFiltersBar,
  type GamesFilterValues,
} from "@/components/dashboard/games-filters";
import {
  fetchMyOrganizationMembership,
  fetchOrganization,
  fetchOrganizationMembers,
  type OrganizationMemberDto,
} from "@/lib/api/organizations";
import { hrefCreateGameModal } from "@/lib/create-game-modal-url";
import { OrganizationLeaveButton } from "@/components/organization/organization-leave-button";
import { labelJoinPolicy, labelOrgRole } from "@/lib/game-labels";

type Props = { params: Promise<{ id: string }> };

export default function OrganizationPage({ params }: Props) {
  const [id, setId] = useState<string>("");
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [name, setName] = useState("Организация");
  const [joinPolicy, setJoinPolicy] = useState<string>("");
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
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
      setId(p.id);
      const numericId = Number(p.id);
      if (Number.isNaN(numericId)) return;
      setOrgId(numericId);
      try {
        const [org, m, membership] = await Promise.all([
          fetchOrganization(numericId),
          fetchOrganizationMembers(numericId),
          fetchMyOrganizationMembership(numericId),
        ]);
        setName(org.name);
        setJoinPolicy(org.joinPolicy ?? "");
        setMembers(m);
        setIsAdmin(membership.isAdmin);
        setIsMember(membership.isMember);
        setIsOwner(membership.isOwner);
      } catch {
        /* toast из apiFetch */
      }
    })();
  }, [params]);

  return (
    <>
      <OrgSubNav orgId={id} />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Text className="text-sm font-mono text-muted-foreground">
            ID {id}
          </Text>
          <H1 className="mt-1">{name}</H1>
          <Text className="mt-2 max-w-2xl text-muted-foreground">
            Обзор клуба
            {joinPolicy ? (
              <>
                {" "}
                · вступление: {labelJoinPolicy(joinPolicy)}
              </>
            ) : null}
          </Text>
        </div>
        {orgId != null ? (
          <OrganizationLeaveButton
            organizationId={orgId}
            isMember={isMember}
            isOwner={isOwner}
            className="w-full gap-2 md:w-auto"
          />
        ) : null}
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
            <GamesFiltersBar
              compact
              values={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            />
            {orgId != null ? (
              <OrganizationGamesList
                organizationId={orgId}
                status={filters.status || undefined}
                result={filters.result || undefined}
                token={filters.token || undefined}
                from={filters.from || undefined}
                to={filters.to || undefined}
                previewLimit={8}
                enableInfiniteScroll={false}
              />
            ) : null}
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/organization/${id}/games`}>
                Все игры организации
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
