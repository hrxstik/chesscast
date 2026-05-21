import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Lead, Text } from "@/components/ui/typography";
import { Shield, Building2, Users, Wallet, Ban } from "lucide-react";
import { AdminBillingPanel } from "@/components/dashboard/admin-billing-panel";
import { AdminPlansPanel } from "@/components/dashboard/admin-plans-panel";
import { AdminManagementPanel } from "@/components/dashboard/admin-management-panel";

export default function SuperAdminDashboardPage() {
  return (
    <div className="space-y-8">
      <H2 className="mt-3">Панель администрирования</H2>

      <div className="grid gap-4 md:grid-cols-2 laptop:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Организации
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Управление данными организаций и пользователей.
            </Text>
            <AdminManagementPanel />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Игроки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Text className="text-sm text-muted-foreground">
              Раздел объединен в общий блок управления.
            </Text>
            <div className="h-24 rounded-lg border border-dashed border-border bg-muted/20" />
          </CardContent>
        </Card>

        <Card className="border-border/80 md:col-span-2 laptop:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ban className="size-4 text-primary" />
              Быстрые действия
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-muted-foreground">
              Массовые операции и аудит — после появления эндпоинтов.
            </Text>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Тарифы и лимиты
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Text className="text-muted-foreground">
            Управление планами через БД: создание, активация/деактивация,
            изменение лимитов.
          </Text>
          <AdminPlansPanel />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-primary" />
            Бухгалтерия
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Text className="text-muted-foreground">
            Данные из БД (Payment, BillingEvent) с живой лентой событий.
          </Text>
          <AdminBillingPanel />
        </CardContent>
      </Card>
    </div>
  );
}
