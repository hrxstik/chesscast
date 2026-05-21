"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Lead, Text } from "@/components/ui/typography";
import { Building2, Hash, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  fetchMyOrganizations,
  fetchOrganizationCreateEligibility,
  joinOrganizationByCode,
  type MyOrganizationDto,
  type OrganizationCreateEligibilityDto,
} from "@/lib/api/organizations";
import { OrganizationSearchCombobox } from "@/components/organization/organization-search-combobox";
import { labelOrgRole } from "@/lib/game-labels";
import toast from "react-hot-toast";

export default function DashboardOrganizationsPage() {
  const [rows, setRows] = useState<MyOrganizationDto[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [eligibility, setEligibility] =
    useState<OrganizationCreateEligibilityDto | null>(null);
  async function load() {
    setLoading(true);
    try {
      const [data, elig] = await Promise.all([
        fetchMyOrganizations(),
        fetchOrganizationCreateEligibility(),
      ]);
      setRows(data);
      setEligibility(elig);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onJoin() {
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      await joinOrganizationByCode(inviteCode.trim());
      setInviteCode("");
      toast.success("Вы вступили в организацию");
      await load();
    } finally {
      setJoining(false);
    }
  }

  const canCreate = eligibility?.canCreate ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <H2>Организации</H2>

          {eligibility && !canCreate && eligibility.message ? (
            <Text className="mt-2 text-sm text-muted-foreground">
              {eligibility.message}
              <br />
              {eligibility.maxOrganizations > 0
                ? `Вы администратор в ${eligibility.adminOrganizationsCount} организаций из ${eligibility.maxOrganizations}`
                : ""}
            </Text>
          ) : eligibility && canCreate ? (
            <Text className="mt-2 text-sm text-muted-foreground">
              Можно создать ещё{" "}
              {eligibility.maxOrganizations -
                eligibility.adminOrganizationsCount}{" "}
              из {eligibility.maxOrganizations} по тарифу
              {eligibility.planTitle ? ` «${eligibility.planTitle}»` : ""}.
            </Text>
          ) : null}
        </div>
        {canCreate ? (
          <Button asChild className="w-full shrink-0 gap-2 md:w-auto">
            <Link href="/organization/create">
              <Plus className="size-4" aria-hidden />
              Создать организацию
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant="secondary"
            className="w-full shrink-0 gap-2 md:w-auto"
          >
            <Link href="/pricing">Тарифы</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Список организаций</CardTitle>
              <Text className="text-sm text-muted-foreground">
                Ваши организации и роли
              </Text>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Text className="text-sm text-muted-foreground">Загрузка…</Text>
            ) : rows.length === 0 ? (
              <Text className="text-sm text-muted-foreground">
                Вы пока не состоите в организациях.
              </Text>
            ) : (
              rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      роль:{" "}
                      {labelOrgRole(r.role)}{" "}
                    </div>
                  </div>
                  <Button asChild variant="outline" className="h-8 text-xs">
                    <Link href={`/organization/${r.id}`}>Открыть</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="size-4 text-primary" aria-hidden />
              Вступить и найти
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Text className="text-sm text-muted-foreground">
                Введите код приглашения организации.
              </Text>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Например: SEED-DEMO-SCHOOL"
                />
                <Button
                  onClick={() => void onJoin()}
                  disabled={joining}
                  className="sm:shrink-0"
                >
                  {joining ? "Вступление…" : "Вступить"}
                </Button>
              </div>
            </div>

            <OrganizationSearchCombobox />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
