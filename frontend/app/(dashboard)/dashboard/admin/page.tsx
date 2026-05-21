"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Lead, Text } from "@/components/ui/typography";
import {
  Shield,
  Users,
  Building2,
  Wallet,
  ScrollText,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { AdminOrganizationsPanel } from "@/components/dashboard/admin-organizations-panel";
import { AdminPlansPanel } from "@/components/dashboard/admin-plans-panel";
import { AdminBillingPanel } from "@/components/dashboard/admin-billing-panel";
import { AdminServiceLogsPanel } from "@/components/dashboard/admin-service-logs-panel";

const TABS = [
  { id: "users", label: "Пользователи", icon: Users },
  { id: "organizations", label: "Организации", icon: Building2 },
  { id: "plans", label: "Тарифы", icon: Wallet },
  { id: "billing", label: "Биллинг", icon: Receipt },
  { id: "logs", label: "Журнал", icon: ScrollText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SuperAdminDashboardPage() {
  const [tab, setTab] = useState<TabId>("users");

  return (
    <div className="space-y-8">
      <H2 className="mt-3">Панель администрирования платформы</H2>

      <nav
        className="flex flex-wrap gap-2 border-b border-border pb-4"
        aria-label="Разделы админ-панели"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {tab === "users" ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Пользователи платформы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminUsersPanel />
          </CardContent>
        </Card>
      ) : null}

      {tab === "organizations" ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Организации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminOrganizationsPanel />
          </CardContent>
        </Card>
      ) : null}

      {tab === "plans" ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Тарифные планы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminPlansPanel />
          </CardContent>
        </Card>
      ) : null}

      {tab === "billing" ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4 text-primary" />
              Биллинг
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminBillingPanel />
          </CardContent>
        </Card>
      ) : null}

      {tab === "logs" ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-primary" />
              Служебный журнал
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminServiceLogsPanel />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
