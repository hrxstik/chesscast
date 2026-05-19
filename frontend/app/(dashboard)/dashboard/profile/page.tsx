'use client';

import { Suspense, useEffect, useState } from 'react';
import { resolveAvatarSrc } from '@/lib/avatar-url';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, Text } from '@/components/ui/typography';
import { User, CreditCard, Shield, Bell, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getCurrentUser, type MeResponse } from '@/lib/api/user';
import {
  updateCurrentUser,
  uploadMyAvatar,
  changeMyPassword,
  deleteMyAccount,
} from '@/lib/api/user';
import { fetchMyCurrentSubscription, type CurrentSubscriptionDto } from '@/lib/api/subscription';
import { ApiError } from '@/lib/api/types';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth-store';

export default function DashboardProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Загрузка…</div>}>
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
  const [subscription, setSubscription] = useState<CurrentSubscriptionDto | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [user, sub] = await Promise.all([getCurrentUser(), fetchMyCurrentSubscription()]);
        setMe(user);
        setName(user.name);
        setSubscription(sub);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить профиль');
      }
    })();
  }, []);

  useEffect(() => {
    if (searchParams.get('payment') !== 'success') return;
    toast.success('Возврат с оплаты. Обновляем данные подписки…');
    void (async () => {
      try {
        const sub = await fetchMyCurrentSubscription();
        setSubscription(sub);
      } catch {
        /* ignore */
      }
    })();
    router.replace('/dashboard/profile', { scroll: false });
  }, [searchParams, router]);

  async function onSave() {
    if (!me) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCurrentUser(me.id, { name: name.trim() || me.name });
      setMe(updated);
      setName(updated.name);
      setUser(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadAvatar(file: File | null) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadMyAvatar(file);
      setMe(updated);
      setUser(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить аватар');
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword() {
    setSaving(true);
    setError(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось изменить пароль');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount() {
    setSaving(true);
    setError(null);
    try {
      await deleteMyAccount({ password: deletePassword });
      await logout();
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить аккаунт');
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = resolveAvatarSrc(me?.avatar);

  return (
    <div className="space-y-8">
      <div>
        <H2>Профиль</H2>
        <Text className="mt-2 max-w-2xl text-muted-foreground">
          Данные аккаунта и подписка.
        </Text>
      </div>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

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
                  {me?.email ?? '—'}
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
                      alt={me?.name ?? 'avatar'}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => void onUploadAvatar(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить изменения'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="relative overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
            <CardHeader className="relative pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Подписка и тарифы
              </CardTitle>
              <Text className="text-xs text-muted-foreground">
                Управление планом и автопродлением — на странице тарифов с оплатой через ЮKassa.
              </Text>
            </CardHeader>
            <CardContent className="relative space-y-4">
              {subscription ? (
                <>
                  <div>
                    <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Текущий план
                    </Text>
                    <p className="mt-1 text-lg font-semibold tracking-tight">{subscription.plan.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted/80 px-2 py-0.5 font-medium text-foreground/80">
                        {subscription.status}
                      </span>
                      <span>
                        Действует до{' '}
                        <time dateTime={subscription.endAt}>
                          {new Date(subscription.endAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </time>
                      </span>
                      {subscription.autoRenew ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                          Автопродление включено
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5">Без автопродления</span>
                      )}
                    </div>
                  </div>
                  <Button asChild className="group w-full justify-between gap-2">
                    <Link href="/pricing">
                      <span className="flex items-center gap-2">
                        <CreditCard className="size-4 opacity-80" aria-hidden />
                        Перейти к тарифам и оплате
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
                    Нет активной подписки в ответе API — выберите тариф, чтобы открыть стриминг и лимиты.
                  </Text>
                  <Button asChild className="group w-full justify-between gap-2">
                    <Link href="/pricing">
                      <span>Посмотреть тарифы</span>
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
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Текущий пароль"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <input
                type="password"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Новый пароль"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button variant="outline" onClick={() => void onChangePassword()} disabled={saving}>
                Сменить пароль
              </Button>
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
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Пароль"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
              <Button variant="destructive" onClick={() => void onDeleteAccount()} disabled={saving}>
                Удалить аккаунт
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

