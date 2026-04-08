'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, Text } from '@/components/ui/typography';
import { User, CreditCard, Shield, Bell } from 'lucide-react';
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
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';

export default function DashboardProfilePage() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearUser = useUserStore((s) => s.clearUser);
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

  async function onSave() {
    if (!me) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCurrentUser(me.id, { name: name.trim() || me.name });
      setMe(updated);
      setName(updated.name);
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
      clearAuth();
      clearUser();
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить аккаунт');
    } finally {
      setSaving(false);
    }
  }

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
                  {me?.avatar ? (
                    <Image
                      src={me.avatar}
                      alt={me.name ?? 'avatar'}
                      className="size-full object-cover"
                      width={64}
                      height={64}
                    />
                  ) : null}
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
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-primary" aria-hidden />
                Подписка
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Text className="text-sm font-medium">
                Текущий план: {subscription?.plan.title ?? 'Нет активной подписки'}
              </Text>
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {subscription
                  ? `Статус: ${subscription.status}, до ${new Date(subscription.endAt).toLocaleDateString()}`
                  : 'Оформите подписку для расширенного доступа'}
              </div>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href="/pricing">Сменить тариф</Link>
              </Button>
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
