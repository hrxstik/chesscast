"use client";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";

export type ChessStreamStreamerControlsProps = {
  viewer: boolean;
  /** Показывать панель управления (камера или WS). */
  showControls: boolean;
  calibrationCompleted: boolean;
  gameStarted: boolean;
  gameFinished: boolean;
  calibrationInProgress: boolean;
  calibrationMessage: string | null;
  onStartGame: () => void;
  /** Показывать «Остановить трансляцию» только при активном видео. */
  canStopStream: boolean;
  onStopStreaming: () => void;
  onOpenFinishGame: () => void;
};

export function ChessStreamStreamerControls({
  viewer,
  showControls,
  calibrationCompleted,
  gameStarted,
  gameFinished,
  calibrationInProgress,
  calibrationMessage,
  onStartGame,
  canStopStream,
  onStopStreaming,
  onOpenFinishGame,
}: ChessStreamStreamerControlsProps) {
  return (
    <>
      {!viewer && showControls ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <Button
              onClick={onStartGame}
              disabled={!calibrationCompleted || gameStarted}
              variant={gameStarted ? "outline" : "default"}
            >
              {gameStarted ? "Партия идёт" : "Начать партию"}
            </Button>
            {canStopStream ? (
              <Button onClick={onStopStreaming} variant="destructive">
                Остановить трансляцию
              </Button>
            ) : null}
            {!gameFinished ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onOpenFinishGame}
              >
                Завершить партию
              </Button>
            ) : null}
          </div>
          {!calibrationCompleted ? (
            <Text className="!text-xs text-muted-foreground">
              Дождитесь завершения автоматической калибровки доски, чтобы начать
              партию.
            </Text>
          ) : null}
          {calibrationInProgress && calibrationMessage ? (
            <Text className="!text-xs text-muted-foreground">
              {calibrationMessage}
            </Text>
          ) : null}
          {calibrationCompleted && calibrationMessage ? (
            <Text className="!text-xs text-muted-foreground">
              {calibrationMessage}
            </Text>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
