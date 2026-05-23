"use client";

import React from "react";
import Link from "next/link";
import { ChessVideoStreamWebRTC } from "@/components/shared";
import { H1, Text } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  fetchGameSessionPublic,
  type GameSessionPublic,
} from "@/lib/api/game-session";

type StreamMode = "conduct" | "viewer";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function WatchGamePage({ params }: Props) {
  const resolvedParams = React.use(params);
  const [mode, setMode] = React.useState<StreamMode | null>(null);
  const [remoteMedia, setRemoteMedia] = React.useState(false);
  const localStreamActiveRef = React.useRef(false);
  const [forbidden, setForbidden] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [gameFinished, setGameFinished] = React.useState(false);

  const applySessionAccess = React.useCallback((data: GameSessionPublic) => {
    if (data.status === "FINISHED") {
      setGameFinished(true);
      setMode(null);
      setForbidden(false);
      return;
    }
    setGameFinished(false);
    if (data.canConduct) {
      setMode("conduct");
      setRemoteMedia(data.hasLiveStream && !localStreamActiveRef.current);
      setForbidden(false);
    } else if (data.canWatchLive) {
      setRemoteMedia(false);
      setMode("viewer");
      setForbidden(false);
    } else {
      setMode(null);
      setForbidden(true);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const res = await fetchGameSessionPublic(resolvedParams.token);
      if (!mounted) return;
      if (!res.ok) {
        if ("networkError" in res) {
          setLoadError(true);
          setForbidden(false);
        } else {
          setLoadError(false);
          setForbidden("forbidden" in res);
        }
        setMode(null);
        return;
      }
      setLoadError(false);
      applySessionAccess(res.data);
    };
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [resolvedParams.token, applySessionAccess]);

  if (loadError) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Не удалось загрузить партию</H1>
        <Text className="text-muted-foreground">Нет связи с API.</Text>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Обновить
        </Button>
      </div>
    );
  }

  if (mode === null && !forbidden && !gameFinished) {
    return <Text className="text-muted-foreground">Проверка доступа…</Text>;
  }

  if (!gameFinished && (forbidden || mode === null)) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Нет доступа</H1>
        <Text className="text-muted-foreground">
          Трансляция недоступна: партия закрытая, завершена, или у вас нет прав
          на ведение или просмотр.
        </Text>
        <Button asChild variant="outline">
          <Link href="/dashboard/games">К списку игр</Link>
        </Button>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Партия завершена</H1>
        <Text className="text-muted-foreground">
          Live-трансляция недоступна. Откройте разбор с записью ходов и анализом
          движка.
        </Text>
        <Button asChild>
          <Link href={`/game/${resolvedParams.token}`}>Перейти к разбору</Link>
        </Button>
      </div>
    );
  }

  const isViewer = mode === "viewer";

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <H1 className="!text-xl md:!text-2xl">
          {isViewer ? "Просмотр трансляции" : "Ведение трансляции"}
        </H1>
        <Badge variant={isViewer ? "secondary" : "default"}>
          {isViewer
            ? "Зритель"
            : remoteMedia
              ? "Ведущий (другое устройство)"
              : "Ведущий"}
        </Badge>
      </div>

      <ChessVideoStreamWebRTC
        gameToken={resolvedParams.token}
        viewer={isViewer}
        remoteMedia={!isViewer && remoteMedia}
        onLocalStreamActive={() => {
          localStreamActiveRef.current = true;
          setRemoteMedia(false);
        }}
      />
    </div>
  );
}
