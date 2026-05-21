"use client";

import { Suspense, useEffect, useState } from "react";
import { resolveAvatarSrc } from "@/lib/avatar-url";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Text } from "@/components/ui/typography";
import { User, CreditCard, Shield, Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getCurrentUser, type MeResponse } from "@/lib/api/user";
import {
  updateCurrentUser,
  uploadMyAvatar,
  changeMyPassword,
  deleteMyAccount,
} from "@/lib/api/user";
import {
  fetchMyCurrentSubscription,
  type CurrentSubscriptionDto,
} from "@/lib/api/subscription";
import { SUBSCRIPTION_STATUS_LABEL } from "@/lib/plan-capabilities";
import { PlanCapabilitiesBlock } from "@/components/shared/plan-capabilities-block";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";

export default function DashboardProfilePage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Загрузка…</div>}
    >
      <DashboardProfileInner />
    </Suspense>
  );
}

function DashboardProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [subscription, setSubscription] =
    useState<CurrentSubscriptionDto | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [user, sub] = await Promise.all([
          getCurrentUser(),
          fetchMyCurrentSubscription(),
        ]);
        setMe(user);
        setName(user.name);
        setSubscription(sub);
      } catch {
        /* toast из apiFetch */
      }
    })();
  }, []);

  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;
    toast.success("Оплата прошла. Обновляем подписку…");
    void (async () => {
      try {
        const sub = await fetchMyCurrentSubscription();
        setSubscription(sub);
      } catch {
        /* toast из apiFetch */
      }
    })();
    router.replace("/dashboard/profile", { scroll: false });
  }, [searchParams, router]);

  async function onSave() {
    if (!me) return;
    setSaving(true);
    try {
      let updated = me;
      if (pendingAvatar) {
        updated = await uploadMyAvatar(pendingAvatar);
        setPendingAvatar(null);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      const nameChanged = name.trim() !== updated.name;
      if (nameChanged) {
        updated = await updateCurrentUser(updated.id, {
          name: name.trim() || updated.name,
        });
      }
      setMe(updated);
      setName(updated.name);
      setUser(updated);
      toast.success("Изменения сохранены");
    } finally {
      setSaving(false);
    }
  }

  function onPickAvatar(file: File | null) {
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setPendingAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onChangePassword() {
    if (newPassword.length < 6) {
      toast.error("Новый пароль — не короче 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Новый пароль и повтор не совпадают");
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль изменён");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount() {
    setSaving(true);
    try {
      await deleteMyAccount({ password: deletePassword });
      await logout();
      router.replace("/");
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = avatarPreview ?? resolveAvatarSrc(me?.avatar);
  const statusLabel = subscription
    ? (SUBSCRIPTION_STATUS_LABEL[subscription.status] ?? "Статус неизвестен")
    : null;

  return (
    <div className="space-y-8">
      <div>
        <H2>Профиль</H2>
        <Text className="mt-2 max-w-2xl text-muted-foreground">
          Данные аккаунта, подписка и безопасность.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" aria-hidden />
              Основное
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Имя
                </Text>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </Text>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  {me?.email ?? "—"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Аватар
              </Text>
              <div className="flex items-center gap-4">
                <div className="size-16 overflow-hidden rounded-full border border-dashed border-border bg-muted/30">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarSrc}
                      alt={me?.name ?? "avatar"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                    onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                  />
                  {pendingAvatar ? (
                    <Text className="text-xs text-muted-foreground">
                      Новый аватар будет загружен при сохранении.
                    </Text>
                  ) : null}
                </div>
              </div>
            </div>
            <Button onClick={() => void onSave()} disabled={saving || !me}>
              {saving ? "Сохранение…" : "Сохранить изменения"}
            </Button>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="size-4 text-primary" aria-hidden />
                  Смена пароля
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <input
                  type="password"
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Текущий пароль"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Новый пароль"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Повторите новый пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => void onChangePassword()}
                  disabled={
                    saving ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  Сменить пароль
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" aria-hidden />
                Подписка и тарифы
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-4">
              {subscription ? (
                <>
                  <div>
                    <p className="text-lg font-semibold tracking-tight">
                      {subscription.plan.title}
                    </p>
                    {subscription.plan.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {subscription.plan.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted/80 px-2 py-0.5 font-medium text-foreground/80">
                        {statusLabel}
                      </span>
                      <span>
                        Действует до{" "}
                        <time dateTime={subscription.endAt}>
                          {new Date(subscription.endAt).toLocaleDateString(
                            "ru-RU",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                        </time>
                      </span>
                      {subscription.autoRenew ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                          Автопродление
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          Без автопродления
                        </span>
                      )}
                    </div>
                  </div>

                  <PlanCapabilitiesBlock
                    planCode={subscription.plan.code}
                    features={subscription.plan.features}
                    limits={{
                      maxGamesPerPeriod: subscription.plan.maxGamesPerPeriod,
                      maxOrganizations: subscription.plan.maxOrganizations,
                      canCreateOrganization:
                        subscription.plan.canCreateOrganization,
                      canStream: subscription.plan.canStream,
                      streamQualityLevel: subscription.plan.streamQualityLevel,
                    }}
                  />

                  <Button
                    asChild
                    className="group w-full justify-between gap-2"
                  >
                    <Link href="/pricing">
                      <span className="flex items-center gap-2">
                        Тарифы и оплата
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Text className="text-sm text-muted-foreground">
                    Нет активной подписки. Выберите тариф на странице оплаты —
                    после успешного платежа в ЮKassa подписка появится здесь.
                  </Text>
                  <Button
                    asChild
                    className="group w-full justify-between gap-2"
                  >
                    <Link href="/pricing">
                      <span>Тарифы и оплата</span>
                      <ChevronRight
                        className="size-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <Shield className="size-4" aria-hidden />
                Опасная зона
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Text className="text-sm text-muted-foreground">
                Подтвердите пароль для удаления аккаунта.
              </Text>
              <input
                type="password"
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Пароль"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
              <Button
                variant="destructive"
                onClick={() => void onDeleteAccount()}
                disabled={saving || !deletePassword}
              >
                Удалить аккаунт
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
