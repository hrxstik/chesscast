import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type * as mediasoupClient from 'mediasoup-client';
import { boardStateToFen } from '@/components/chess-stream/lib/board-state-to-fen';
import { notifyError } from '@/lib/notify';
import type { ChessStreamRefs } from './chess-stream-ref-types';

const STABLE_THRESHOLD = 5;

export type ChessStreamSocketRegisterContext = {
  gameToken: string;
  modelPath?: string;
  viewer: boolean;
  refs: ChessStreamRefs;
  setHasVideoStream: (b: boolean) => void;
  setIsStreaming: (b: boolean) => void;
  setCalibrationInProgress: (b: boolean) => void;
  setCalibrationCompleted: (b: boolean) => void;
  setCalibrationMessage: (s: string | null) => void;
  setGameStarted: (b: boolean) => void;
  setMoves: Dispatch<SetStateAction<{ san: string }[]>>;
  setMappingData: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  setPositionFromFen: (fen: string) => void;
  onGameFinished?: () => void;
  /** Стрим остановлен с другого устройства или сервером. */
  onStreamStopped?: () => void;
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
  const applyStreamSync = (data: {
    boardCalibrated?: boolean;
    gameInProgress?: boolean;
  }) => {
    if (data.boardCalibrated) {
      setCalibrationCompleted(true);
      setCalibrationInProgress(false);
      setCalibrationMessage('Доска откалибрована');
    }
    if (data.gameInProgress) {
      setGameStarted(true);
    }
  };

  const {
    gameToken,
    modelPath,
    viewer,
    refs,
    setHasVideoStream,
    setIsStreaming,
    setCalibrationInProgress,
    setCalibrationCompleted,
    setCalibrationMessage,
    setGameStarted,
    setMoves,
    setMappingData,
    setPositionFromFen,
    onGameFinished,
    onStreamStopped,
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
          notifyError('Браузер не поддерживает отображение видеопотока');
        }
      }
    };
    img.onerror = () => {
      notifyError('Не удалось загрузить кадр видео');
    };
    img.src = `data:image/jpeg;base64,${data.frame}`;
  });

  newSocket.on('connect', () => {
    if (viewer) {
      newSocket.emit('join-stream', { token: gameToken });
      setIsStreaming(true);
    } else {
      let attempts = 0;
      const emitStartStream = () => {
        if (streamRef.current?.active) {
          newSocket.emit('start-stream', { token: gameToken, modelPath });
          return;
        }
        attempts += 1;
        if (attempts < 80) {
          setTimeout(emitStartStream, 100);
        } else {
          notifyError(
            'Камера не готова. Разрешите доступ к камере и нажмите «Запустить видеопоток» снова.',
          );
        }
      };
      emitStartStream();
    }
  });

  newSocket.on('stream-started', (data?: { boardCalibrated?: boolean; gameInProgress?: boolean }) => {
    setIsStreaming(true);
    if (data) applyStreamSync(data);
    if (!viewer) {
      setCalibrationCompleted(false);
      setCalibrationInProgress(false);
      setCalibrationMessage('Ожидание калибровки доски…');
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

      let producerAttempts = 0;
      const tryCreateProducer = () => {
        if (streamRef.current && !producerRef.current) {
          try {
            newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
          } catch {
            /* ignore */
          }
          return;
        }
        producerAttempts += 1;
        if (producerAttempts < 100) {
          setTimeout(tryCreateProducer, 100);
        }
      };
      tryCreateProducer();
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
        notifyError(`Ошибка инициализации медиапотока: ${(error as Error).message}`);
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
        notifyError(`Ошибка подключения к потоку: ${(error as Error).message}`);
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
        notifyError(`Ошибка подключения к потоку: ${(error as Error).message}`);
      }
    }
  });

  newSocket.on('stream-joined', (data?: { boardCalibrated?: boolean; gameInProgress?: boolean }) => {
    setIsStreaming(true);
    if (data) applyStreamSync(data);
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
      return;
    }
    onStreamStopped?.();
  });

  newSocket.on('calibration-started', (data: { message: string }) => {
    setCalibrationInProgress(true);
    setCalibrationCompleted(false);
    setCalibrationMessage(data.message || 'Калибровка доски...');
  });

  newSocket.on('game-started', () => {
    setGameStarted(true);
  });

  newSocket.on('game-finished', () => {
    setGameStarted(false);
    setIsStreaming(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    onGameFinished?.();
  });

  newSocket.on('calibration-failed', (data: { message: string }) => {
    setCalibrationInProgress(true);
    setCalibrationCompleted(false);
    setCalibrationMessage(
      data.message || 'Калибровка не удалась. Наведите камеру на доску.',
    );
  });

  newSocket.on('calibration-completed', (data: { message: string; mappingData?: unknown }) => {
    setCalibrationInProgress(false);
    setCalibrationCompleted(true);
    setCalibrationMessage(data.message || 'Калибровка выполнена');
    if (data.mappingData && typeof data.mappingData === 'object' && data.mappingData !== null) {
      setMappingData(data.mappingData as Record<string, unknown>);
    }
  });

  newSocket.on('frame-processed', (data: Record<string, unknown>) => {
    if (data.board_state && Array.isArray(data.board_state)) {
      try {
        const fen = boardStateToFen(data.board_state as number[][]);
        const history = boardStateHistoryRef.current;
        history.push(fen);
        if (history.length > 8) {
          history.shift();
        }
        const lastN = history.slice(-STABLE_THRESHOLD);
        const isStable =
          lastN.length === STABLE_THRESHOLD && lastN.every((f) => f === fen);
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

    if (data.move_san) {
      const san = String(data.move_san);
      setMoves((prev) => {
        const lastMove = prev[prev.length - 1];
        if (lastMove?.san === san) {
          return prev;
        }
        return [...prev, { san }];
      });
    } else if (data.status === 'error' && data.message) {
      notifyError(String(data.message));
    }
  });

  newSocket.on('error', (error: { message: string }) => {
    const msg = error.message ?? '';
    if (msg === 'Требуется авторизация для трансляции') {
      notifyError(
        'Сессия не передана на сервер. Выйдите и войдите снова на этом устройстве, затем запустите видеопоток.',
      );
      return;
    }
    notifyError(msg);
  });

  newSocket.on('disconnect', (reason) => {
    setIsStreaming(false);
    if (reason === 'io server disconnect') {
      setCalibrationInProgress(false);
      setCalibrationCompleted(false);
      setCalibrationMessage(null);
      setGameStarted(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }
  });

  newSocket.on('reconnect', async () => {
    if (viewerRef.current) {
      newSocket.emit('join-stream', { token: gameToken });
      newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
      newSocket.emit('get-producers', { token: gameToken });
    } else if (streamRef.current) {
      newSocket.emit('start-stream', { token: gameToken, modelPath });
    }
  });
}
