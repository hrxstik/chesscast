'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  Crown,
  Hash,
  Minus,
  Swords,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/typography';
import { resolveAvatarSrc } from '@/lib/avatar-url';
import type { GameSessionPlayer, GameSessionPublic } from '@/lib/api/game-session';
import {
  labelGameScope,
  labelPieceColor,
  labelResult,
  labelStatus,
  labelVisibility,
} from '@/lib/game-labels';
import {
  getSideOutcome,
  outcomeBadgeText,
  type SideOutcome,
} from '@/lib/game-result-ui';
import { cn } from '@/lib/utils';

type Props = {
  session: GameSessionPublic | null;
  statusText: string;
  token: string;
};

function OutcomeBadge({ outcome }: { outcome: SideOutcome }) {
  const text = outcomeBadgeText(outcome);
  if (!text) return null;
  if (outcome === 'win') {
    return (
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
        title="Победа"
      >
        <Crown className="size-3.5" aria-hidden />
      </span>
    );
  }
  if (outcome === 'draw') {
    return (
      <span
        className="inline-flex min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold tabular-nums"
        title="Ничья"
      >
        ½
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/80 text-muted-foreground"
      title="Поражение"
    >
      <Minus className="size-3.5" aria-hidden />
    </span>
  );
}

function PlayerCard({
  player,
  gameResult,
}: {
  player: GameSessionPlayer;
  gameResult?: string | null;
}) {
  const avatarSrc = resolveAvatarSrc(player.avatar);
  const outcome = getSideOutcome(gameResult, player.color);
  const isWhite = player.color === 'WHITE';

  return (
    <Link
      href={`/player/${player.userId}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40',
        isWhite
          ? 'border-border/80 bg-muted/15'
          : 'border-border/80 bg-background',
      )}
    >
      <div
        className={cn(
          'relative size-11 shrink-0 overflow-hidden rounded-full border-2',
          isWhite ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-700 bg-zinc-900',
        )}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <span
            className={cn(
              'flex size-full items-center justify-center text-xs font-semibold',
              isWhite ? 'text-zinc-600' : 'text-zinc-300',
            )}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{player.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {labelPieceColor(player.color)}
        </p>
      </div>
      <OutcomeBadge outcome={outcome} />
    </Link>
  );
}

function AboutError({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/10 p-4">
      <Text className="text-sm text-muted-foreground">{children}</Text>
      {action}
    </div>
  );
}

export function GameAboutPanel({ session, statusText, token }: Props) {
  if (!session) {
    if (statusText === 'not-finished') {
      return (
        <AboutError
          action={
            <Link
              href={`/game/watch/${token}`}
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Смотреть трансляцию
            </Link>
          }
        >
          Разбор доступен только после завершения партии. Пока идёт трансляция —
          откройте просмотр.
        </AboutError>
      );
    }
    if (statusText === 'forbidden') {
      return (
        <AboutError
          action={
            <Link
              href={`/login?next=${encodeURIComponent(`/game/${token}`)}`}
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Войти, чтобы проверить доступ
            </Link>
          }
        >
          Эта партия приватная. Доступ только у создателя, игроков и участников
          организации.
        </AboutError>
      );
    }
    return (
      <AboutError>
        {statusText || 'Загрузка…'}
      </AboutError>
    );
  }

  const white = session.players.find((p) => p.color === 'WHITE');
  const black = session.players.find((p) => p.color === 'BLACK');
  const created = new Date(session.createdAt).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{labelStatus(session.status)}</Badge>
        <Badge variant="muted">{labelVisibility(session.visibility)}</Badge>
        <Badge variant="outline" className="border-dashed">
          {labelGameScope(session.organization?.id)}
        </Badge>
        {session.status === 'FINISHED' ? (
          <Badge variant="default" className="bg-primary/90">
            {labelResult(session.result)}
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2">
          <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-muted-foreground">Создана</p>
            <p className="font-medium leading-snug">{created}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2">
          <Swords className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-muted-foreground">Ходов</p>
            <p className="font-medium tabular-nums">{session.moves.length}</p>
          </div>
        </div>
      </div>

      {session.organization ? (
        <Link
          href={`/organization/${session.organization.id}`}
          className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/15 p-3 transition-colors hover:bg-muted/30"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Организация</p>
            <p className="truncate text-sm font-medium">
              {session.organization.name}
            </p>
          </div>
        </Link>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
          Участники
        </div>
        <div className="space-y-2">
          {white ? (
            <PlayerCard player={white} gameResult={session.result} />
          ) : null}
          {black ? (
            <PlayerCard player={black} gameResult={session.result} />
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <Hash className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate font-mono">{session.token}</span>
      </div>
    </div>
  );
}
