import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type * as mediasoupClient from 'mediasoup-client';
import { boardStateToFen } from '@/components/chess-stream/lib/board-state-to-fen';
import type { ChessStreamRefs } from './chess-stream-ref-types';

const STABLE_THRESHOLD = 5;

export type ChessStreamSocketRegisterContext = {
  gameToken: string;
  modelPath?: string;
  viewer: boolean;
  refs: ChessStreamRefs;
  setError: (s: string | null) => void;
  setHasVideoStream: (b: boolean) => void;
  setIsStreaming: (b: boolean) => void;
  setCalibrationInProgress: (b: boolean) => void;
  setCalibrationCompleted: (b: boolean) => void;
  setCalibrationMessage: (s: string | null) => void;
  setGameStarted: (b: boolean) => void;
  setMoves: Dispatch<SetStateAction<{ san: string; uci: string }[]>>;
  setMappingData: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  setPositionFromFen: (fen: string) => void;
  captureAndSendFrame: () => void;
  initMediasoupDevice: (
    rtp: mediasoupClient.types.RtpCapabilities,
  ) => Promise<mediasoupClient.types.Device | null>;
  createProducer: (stream: MediaStream) => Promise<unknown>;
  createConsumer: (producerId: string) => Promise<unknown>;
};

/** Регистрирует все обработчики Socket.IO для chess-stream (без JSX). */
export function registerChessStreamSocketHandlers(
  newSocket: Socket,
  ctx: ChessStreamSocketRegisterContext,
): void {
  const {
    gameToken,
    modelPath,
    viewer,
    refs,
    setError,
    setHasVideoStream,
    setIsStreaming,
    setCalibrationInProgress,
    setCalibrationCompleted,
    setCalibrationMessage,
    setGameStarted,
    setMoves,
    setMappingData,
    setPositionFromFen,
    captureAndSendFrame,
    initMediasoupDevice,
    createProducer,
    createConsumer,
  } = ctx;

  const {
    videoRef,
    canvasRef,
    consumerRef,
    deviceRef,
    producerRef,
    streamRef,
    frameIntervalRef,
    socketRef,
    boardStateHistoryRef,
    boardStateStableCountRef,
    viewerRef,
    gameStartedRef,
  } = refs;

  newSocket.on('video-frame', (data: { token: string; frame: string }) => {
    if (consumerRef.current || (viewerRef.current && deviceRef.current)) {
      return;
    }
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const img = new Image();
    img.onload = () => {
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx2d.drawImage(img, 0, 0);
      if (!video.srcObject) {
        try {
          const stream = canvas.captureStream(30);
          video.srcObject = stream;
          setHasVideoStream(true);
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.play().catch(() => {
            setTimeout(() => {
              video.play().catch(() => {});
            }, 100);
          });
        } catch {
          setError('Ваш браузер не поддерживает отображение видеопотока');
        }
      }
    };
    img.onerror = () => {
      setError('Не удалось загрузить кадр видео');
    };
    img.src = `data:image/jpeg;base64,${data.frame}`;
  });

  newSocket.on('connect', () => {
    setError(null);
    if (viewer) {
      newSocket.emit('join-stream', { token: gameToken });
      setIsStreaming(true);
    } else {
      newSocket.emit('start-stream', { token: gameToken, modelPath });
    }
  });

  newSocket.on('stream-started', () => {
    setIsStreaming(true);
    if (!viewer) {
      const startSendingFrames = () => {
        if (
          videoRef.current &&
          videoRef.current.videoWidth > 0 &&
          videoRef.current.videoHeight > 0
        ) {
          frameIntervalRef.current = setInterval(() => {
            captureAndSendFrame();
          }, 333);
        } else {
          setTimeout(startSendingFrames, 100);
        }
      };
      startSendingFrames();

      const tryCreateProducer = () => {
        if (streamRef.current && !producerRef.current) {
          try {
            newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
          } catch {
            /* ignore */
          }
        } else {
          setTimeout(tryCreateProducer, 100);
        }
      };
      if (streamRef.current) {
        tryCreateProducer();
      } else {
        setTimeout(tryCreateProducer, 200);
      }
    }
  });

  newSocket.on(
    'router-rtp-capabilities',
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        await initMediasoupDevice(rtpCapabilities);
        if (!viewer && streamRef.current && !producerRef.current) {
          await createProducer(streamRef.current);
        } else if (viewer) {
          newSocket.emit('get-producers', { token: gameToken });
        }
      } catch (error) {
        setError(`Ошибка инициализации медиапотока: ${(error as Error).message}`);
      }
    },
  );

  newSocket.on('producers', async (producers: Array<{ id: string; kind: string }>) => {
    if (viewer && producers.length > 0 && !consumerRef.current) {
      try {
        const videoProducer = producers.find((p) => p.kind === 'video');
        if (videoProducer && deviceRef.current) {
          await createConsumer(videoProducer.id);
        }
      } catch (error) {
        setError(`Ошибка подключения к потоку: ${(error as Error).message}`);
      }
    } else if (viewer && producers.length === 0 && !consumerRef.current) {
      setTimeout(() => {
        if (socketRef.current && !consumerRef.current) {
          socketRef.current.emit('get-producers', { token: gameToken });
        }
      }, 1000);
    }
  });

  newSocket.on('producer-created', async (data: { producerId: string; token: string }) => {
    if (viewer && data.token === gameToken && !consumerRef.current) {
      try {
        if (!deviceRef.current) {
          newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
          setTimeout(() => {
            if (socketRef.current && !consumerRef.current) {
              socketRef.current.emit('get-producers', { token: gameToken });
            }
          }, 500);
        } else {
          await createConsumer(data.producerId);
        }
      } catch (error) {
        setError(`Ошибка подключения к потоку: ${(error as Error).message}`);
      }
    }
  });

  newSocket.on('stream-joined', () => {
    setIsStreaming(true);
    if (viewer) {
      try {
        newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
        newSocket.emit('get-producers', { token: gameToken });
      } catch {
        /* ignore */
      }
    }
  });

  newSocket.on('stream-stopped', () => {
    if (viewer) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        setHasVideoStream(false);
      }
      setIsStreaming(false);
    }
  });

  newSocket.on('calibration-started', (data: { message: string }) => {
    setError(null);
    setCalibrationInProgress(true);
    setCalibrationCompleted(false);
    setCalibrationMessage(data.message || 'Калибровка доски...');
  });

  newSocket.on('calibration-completed', (data: { message: string; mappingData?: unknown }) => {
    setError(null);
    setCalibrationInProgress(false);
    setCalibrationCompleted(true);
    setCalibrationMessage(data.message || 'Калибровка выполнена');
    if (data.mappingData && typeof data.mappingData === 'object' && data.mappingData !== null) {
      setMappingData(data.mappingData as Record<string, unknown>);
    }
  });

  newSocket.on('frame-processed', (data: Record<string, unknown>) => {
    if (data.board_state && Array.isArray(data.board_state)) {
      if (viewerRef.current || gameStartedRef.current) {
        try {
          const fen = boardStateToFen(data.board_state as number[][]);
          const history = boardStateHistoryRef.current;
          history.push(fen);
          if (history.length > 8) {
            history.shift();
          }
          const lastN = history.slice(-STABLE_THRESHOLD);
          const isStable = lastN.length === STABLE_THRESHOLD && lastN.every((f) => f === fen);
          if (isStable) {
            boardStateStableCountRef.current = STABLE_THRESHOLD;
            try {
              setPositionFromFen(fen);
            } catch {
              /* ignore FEN */
            }
          } else {
            boardStateStableCountRef.current = 0;
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (data.move) {
      if (!viewerRef.current && !gameStartedRef.current) {
        return;
      }
      setMoves((prev) => {
        const lastMove = prev[prev.length - 1];
        const uci = String(data.move);
        if (lastMove && lastMove.uci === uci) {
          return prev;
        }
        return [
          ...prev,
          {
            san: String(data.move_san || data.move),
            uci,
          },
        ];
      });
    } else if (data.status === 'error' && data.message) {
      setError(String(data.message));
    }
  });

  newSocket.on('error', (error: { message: string }) => {
    setError(error.message);
  });

  newSocket.on('disconnect', () => {
    setIsStreaming(false);
    setCalibrationInProgress(false);
    setCalibrationCompleted(false);
    setCalibrationMessage(null);
    setGameStarted(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  });
}
