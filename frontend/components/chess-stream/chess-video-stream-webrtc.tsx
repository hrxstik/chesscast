'use client';

import React from 'react';
import { useEngine } from '@/lib/hooks/useEngine';
import { SquareChessboard } from '@/components/game/square-chessboard';
import { streamVideoContainerClass } from '@/lib/stream-config';
import { H3, Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChessStreamGrid } from '@/components/chess-stream/chess-stream-grid';
import { StreamAnalysisSidebar } from '@/components/chess-stream/stream-analysis-sidebar';
import { ChessStreamStreamerControls } from '@/components/chess-stream/chess-stream-streamer-controls';
import { useChessStreamWebRtc } from '@/components/chess-stream/hooks/use-chess-stream-webrtc';

interface ChessVideoStreamProps {
  gameToken: string;
  modelPath?: string;
  viewer?: boolean;
}

export const ChessVideoStreamWebRTC: React.FC<ChessVideoStreamProps> = ({
  gameToken,
  modelPath,
  viewer = false,
}) => {
  const {
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
    setPositionFromFen,
    pvRows,
  } = useEngine(undefined, { multiPv: 3 });

  const {
    videoRef,
    canvasRef,
    handleVideoClick,
    hasVideoStream,
    setHasVideoStream,
    isStreaming,
    viewer: viewerMode,
    startStreaming,
    a1SelectionMode,
    setA1SelectionMode,
    a1Setting,
    setA1Setting,
    moves,
    streamerControlsProps,
  } = useChessStreamWebRtc({
    gameToken,
    modelPath,
    viewer,
    setPositionFromFen,
  });

  return (
    <ChessStreamGrid
      videoColumn={
        <div className={cn(streamVideoContainerClass, 'relative')}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              display: hasVideoStream || !!videoRef.current?.srcObject ? 'block' : 'none',
              backgroundColor: '#000',
              cursor: a1SelectionMode ? 'crosshair' : 'default',
            }}
            onClick={handleVideoClick}
            onLoadedMetadata={() => {
              void videoRef.current?.play().catch(() => {});
              setHasVideoStream(true);
            }}
            onCanPlay={() => setHasVideoStream(true)}
            onPlay={() => setHasVideoStream(true)}
            onPlaying={() => setHasVideoStream(true)}
            onLoadedData={() => setHasVideoStream(true)}
            onError={() => setHasVideoStream(false)}
          />
          {!hasVideoStream && !videoRef.current?.srcObject ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-4 text-center">
              <Text className="!mb-0 text-primary-foreground">
                {viewerMode ? 'Ожидание видеопотока…' : 'Видео не запущено'}
              </Text>
              {!isStreaming && !viewerMode ? (
                <Button type="button" onClick={startStreaming}>
                  Начать стрим
                </Button>
              ) : null}
            </div>
          ) : null}
          {hasVideoStream && videoRef.current?.srcObject ? (
            <Badge className="absolute left-2 top-2 z-10" variant="secondary">
              {viewerMode ? 'Просмотр' : 'Камера'}
            </Badge>
          ) : null}
          <canvas ref={canvasRef} className="hidden" />
          {isStreaming && hasVideoStream ? (
            <Badge
              className="absolute right-2 top-2 z-10 border-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              variant="default">
              LIVE
            </Badge>
          ) : null}
          {a1SelectionMode ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
              <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
                <H3 className="!text-lg">Укажите клетку a1</H3>
                <Text className="mt-2 text-muted-foreground">
                  Кликните на клетку a1 (угол с белой ладьёй).
                </Text>
                {a1Setting ? (
                  <Text className="mt-2 text-sm text-primary">Обработка…</Text>
                ) : null}
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => {
                    setA1SelectionMode(false);
                    setA1Setting(false);
                  }}
                  variant="outline"
                  disabled={a1Setting}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      }
      boardColumn={
        <>
          <Text className="!mb-0 w-full text-center !text-sm font-medium">
            Игрок 1<span className="text-muted-foreground"> · белые</span>
          </Text>
          <div className="w-full max-w-[min(100%,560px)]">
            <SquareChessboard options={chessboardOptions} />
          </div>
          <Text className="!mb-0 w-full text-center !text-sm font-medium">
            Игрок 2<span className="text-muted-foreground"> · чёрные</span>
          </Text>
        </>
      }
      sidebar={
        <StreamAnalysisSidebar
          moves={moves}
          engineReady={engineReady}
          depth={depth}
          positionEvaluation={positionEvaluation}
          possibleMate={possibleMate}
          bestLine={bestLine}
          pvRows={pvRows}
        />
      }
      renderStreamerControls={() => <ChessStreamStreamerControls {...streamerControlsProps} />}
    />
  );
};
