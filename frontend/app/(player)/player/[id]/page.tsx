"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { H1, Text } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import React from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, User, ArrowRight } from "lucide-react";
import {
  getPublicUserProfile,
  type PublicUserProfileResponse,
} from "@/lib/api/user";
import { resolveAvatarSrc } from "@/lib/avatar-url";
import { ApiError } from "@/lib/api/types";
import {
  labelGameScope,
  labelOrgRole,
  labelPieceColor,
  labelResult,
  labelStatus,
} from "@/lib/game-labels";

export default function PlayerPage() {
  const params = useParams();
  const userIdFromUrl = params.id;
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] =
    React.useState<PublicUserProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isOwner = user?.id.toString() === userIdFromUrl;
  const avatarSrc = resolveAvatarSrc(profile?.avatar);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getPublicUserProfile(Number(userIdFromUrl));
        setProfile(data);
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.message
            : "Не удалось загрузить профиль игрока",
        );
      }
    })();
  }, [userIdFromUrl]);

  return (
    <div className="space-y-8">
      <div>
        <Text className="text-sm font-mono text-muted-foreground">
          ID {userIdFromUrl}
        </Text>
        <H1 className="mt-1">
          {isOwner
            ? "Ваш профиль"
            : profile
              ? profile.name
              : `Профиль игрока ${userIdFromUrl}`}
        </H1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-primary" />
              Об игроке
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="size-24 overflow-hidden rounded-full border-2 border-border bg-muted/40">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={profile?.name ?? "Аватар игрока"}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <User className="size-10 opacity-40" aria-hidden />
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              <Text className="text-sm font-medium">
                {profile?.name ?? "—"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                в системе с{" "}
                {profile
                  ? new Date(profile.createdAt).toLocaleDateString("ru-RU")
                  : "—"}
              </Text>
            </div>
            <div className="w-full space-y-1">
              {profile?.organizations.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  className="rounded border border-border/70 px-2 py-1 text-xs"
                >
                  <Link
                    href={`/organization/${o.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {o.name}
                  </Link>
                  {" · "}
                  {labelOrgRole(o.role)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gamepad2 className="size-4 text-primary" />
              Недавние партии
            </CardTitle>
            {isOwner ? (
              <Button asChild variant="outline" className="gap-2">
                <Link href="/dashboard/games">
                  Все игры
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {(profile?.recentGames ?? []).map((g) => (
              <Link
                key={g.id}
                href={
                  g.status === "FINISHED"
                    ? `/game/${g.token}`
                    : `/game/watch/${g.token}`
                }
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-mono text-xs">
                    {g.token.slice(0, 14)}…
                  </div>
                  <Text className="text-xs text-muted-foreground">
                    {labelGameScope(g.organization?.id)}
                    {g.organization ? ` · ${g.organization.name}` : ""}
                    {" · "}
                    {labelPieceColor(g.color)}
                  </Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{labelStatus(g.status)}</Badge>
                  {g.status === "FINISHED" ? (
                    <span className="text-xs text-muted-foreground">
                      {labelResult(g.result)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
            {(profile?.recentGames.length ?? 0) === 0 ? (
              <Text className="pt-2 text-center text-sm text-muted-foreground">
                {user
                  ? "Нет партий, которые вам разрешено видеть"
                  : "Войдите, чтобы видеть закрытые партии клуба и свои игры с этим игроком"}
              </Text>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
