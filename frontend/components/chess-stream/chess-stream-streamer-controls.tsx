'use client';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

export type ChessStreamStreamerControlsProps = {
  viewer: boolean;
  isStreaming: boolean;
  calibrationCompleted: boolean;
  gameStarted: boolean;
  calibrationInProgress: boolean;
  calibrationMessage: string | null;
  onStartGame: () => void;
  onStopStreaming: () => void;
};

export function ChessStreamStreamerControls({
  viewer,
  isStreaming,
  calibrationCompleted,
  gameStarted,
  calibrationInProgress,
  calibrationMessage,
  onStartGame,
  onStopStreaming,
}: ChessStreamStreamerControlsProps) {
  return (
    <>
      {!viewer && isStreaming ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <Button
              onClick={onStartGame}
              disabled={!calibrationCompleted || gameStarted}
              variant={gameStarted ? 'outline' : 'default'}>
              {gameStarted ? 'Партия идёт' : 'Начать партию'}
            </Button>
            <Button onClick={onStopStreaming} variant="destructive">
              Остановить стрим
            </Button>
          </div>
          {!calibrationCompleted ? (
            <Text className="!text-xs text-muted-foreground">
              Дождитесь завершения автоматической калибровки доски, чтобы начать партию.
            </Text>
          ) : null}
          {calibrationInProgress && calibrationMessage ? (
            <Text className="!text-xs text-muted-foreground">{calibrationMessage}</Text>
          ) : null}
          {calibrationCompleted && calibrationMessage ? (
            <Text className="!text-xs text-muted-foreground">{calibrationMessage}</Text>
          ) : null}
        </div>
      ) : null}
    </>
  );
}