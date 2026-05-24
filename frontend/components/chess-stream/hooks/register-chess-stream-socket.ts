import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type * as mediasoupClient from 'mediasoup-client';
import { boardStateToFen } from '@/components/chess-stream/lib/board-state-to-fen';
import { BOARD_FEN_STABLE_FRAMES, CV_FRAME_INTERVAL_MS } from '@/lib/stream-config';
import { notifyError } from '@/lib/notify';
import type { ChessStreamRefs } from './chess-stream-ref-types';

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
  onStreamStopped?: () => void;
  captureAndSendFrame: () => void;
  initMediasoupDevice: (
    rtp: mediasoupClient.types.RtpCapabilities,
  ) => Promise<mediasoupClient.types.Device | null>;
  createProducer: (stream: MediaStream) => Promise<unknown>;
  createConsumer: (producerId: string) => Promise<unknown>;
  tryConsumePending: () => void | Promise<void>;
  teardownAllMedia: () => void;
  closeRecvSide: () => void;
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
    tryConsumePending,
    teardownAllMedia,
    closeRecvSide,
  } = ctx;

  const {
    videoRef,
    canvasRef,
    consumerRef,
    deviceRef,
    producerRef,
    recvTransportRef,
    streamRef,
    frameIntervalRef,
    socketRef,
    boardStateHistoryRef,
    consumerCreatingRef,
    viewerRef,
    localStreamingRef,
    pendingProducerIdRef,
  } = refs;

  const requestViewerConnect = () => {
    if (!viewerRef.current) return;
    if (consumerRef.current) return;
    try {
      newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
    } catch {
      /* ignore */
    }
  };

  const schedulePendingConsume = () => {
    window.setTimeout(() => {
      void tryConsumePending();
    }, 0);
  };

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
      requestViewerConnect();
    } else if (localStreamingRef.current) {
      newSocket.emit('start-stream', { token: gameToken, modelPath });
    }
  });

  newSocket.on('stream-started', (data?: { boardCalibrated?: boolean; gameInProgress?: boolean }) => {
    setIsStreaming(true);
    if (!viewer) {
      setCalibrationCompleted(false);
      setCalibrationInProgress(true);
      setCalibrationMessage('Определение доски…');
      setGameStarted(false);
    } else if (data?.gameInProgress) {
      setGameStarted(true);
    }
    if (data?.boardCalibrated && !viewer) {
      applyStreamSync(data);
    }
    if (viewer) {
      if (!consumerRef.current) {
        closeRecvSide();
        deviceRef.current = null;
        consumerCreatingRef.current = false;
        pendingProducerIdRef.current = null;
        requestViewerConnect();
      }
    }
    if (!viewer && localStreamingRef.current) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      const startSendingFrames = () => {
        if (
          videoRef.current &&
          videoRef.current.videoWidth > 0 &&
          videoRef.current.videoHeight > 0
        ) {
          frameIntervalRef.current = setInterval(() => {
            captureAndSendFrame();
          }, CV_FRAME_INTERVAL_MS);
        } else {
          setTimeout(startSendingFrames, 100);
        }
      };
      startSendingFrames();

      if (streamRef.current && !producerRef.current) {
        newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
      }
    }
  });

  newSocket.on(
    'router-rtp-capabilities',
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        await initMediasoupDevice(rtpCapabilities);
        if (!viewer && streamRef.current && !producerRef.current && localStreamingRef.current) {
          await createProducer(streamRef.current);
        } else if (viewer) {
          newSocket.emit('get-producers', { token: gameToken });
          schedulePendingConsume();
        }
      } catch (error) {
        notifyError(`Ошибка инициализации медиапотока: ${(error as Error).message}`);
      }
    },
  );

  newSocket.on('producers', async (producers: Array<{ id: string; kind: string }>) => {
    if (!viewerRef.current || consumerRef.current) return;
    const videoProducer = producers.find((p) => p.kind === 'video');
    if (!videoProducer) {
      if (producers.length === 0) {
        setTimeout(() => {
          if (socketRef.current && !consumerRef.current && viewerRef.current) {
            socketRef.current.emit('get-producers', { token: gameToken });
          }
        }, 1000);
      }
      return;
    }
    if (!deviceRef.current) {
      pendingProducerIdRef.current = videoProducer.id;
      newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
      return;
    }
  if (!videoRef.current) {
      pendingProducerIdRef.current = videoProducer.id;
      schedulePendingConsume();
      return;
    }
    try {
      await createConsumer(videoProducer.id);
    } catch (error) {
      notifyError(`Ошибка подключения к потоку: ${(error as Error).message}`);
    }
  });

  newSocket.on('producer-created', async (data: { producerId: string; token: string }) => {
    if (!viewerRef.current || data.token !== gameToken || consumerRef.current) {
      return;
    }
    pendingProducerIdRef.current = data.producerId;
    if (!deviceRef.current) {
      newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
      return;
    }
    schedulePendingConsume();
  });

  newSocket.on('stream-joined', (data?: { boardCalibrated?: boolean; gameInProgress?: boolean }) => {
    setIsStreaming(true);
    if (data) applyStreamSync(data);
    if (viewer) {
      requestViewerConnect();
    }
  });

  newSocket.on('stream-stopped', () => {
    if (viewer) {
      teardownAllMedia();
      setHasVideoStream(false);
      setIsStreaming(false);
      boardStateHistoryRef.current = [];
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
    if (data.detection_skipped || data.hand_frozen) {
      return;
    }

    if (data.board_state && Array.isArray(data.board_state)) {
      try {
        const fen = boardStateToFen(data.board_state as number[][]);
        if (fen) {
          const history = boardStateHistoryRef.current;
          history.push(fen);
          if (history.length > BOARD_FEN_STABLE_FRAMES) {
            history.shift();
          }
          const lastN = history.slice(-BOARD_FEN_STABLE_FRAMES);
          const isStable =
            lastN.length === BOARD_FEN_STABLE_FRAMES &&
            lastN.every((f) => f === fen);
          if (isStable) {
            try {
              setPositionFromFen(fen);
            } catch {
              /* ignore FEN */
            }
          }
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
    if (reason === 'io server disconnect') {
      setIsStreaming(false);
      setCalibrationInProgress(false);
      setCalibrationCompleted(false);
      setCalibrationMessage(null);
      setGameStarted(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      teardownAllMedia();
    }
  });

  newSocket.on('reconnect', async () => {
    if (viewerRef.current) {
      newSocket.emit('join-stream', { token: gameToken });
      requestViewerConnect();
    } else if (localStreamingRef.current) {
      newSocket.emit('start-stream', { token: gameToken, modelPath });
    }
  });
}
