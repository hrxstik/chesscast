'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getWsUrl } from '@/lib/utils';
import { useChessStreamRefs } from './use-chess-stream-refs';
import { useChessStreamMediasoup } from './use-chess-stream-mediasoup';
import { useChessStreamCamera } from './use-chess-stream-camera';
import { useChessStreamFrameCapture } from './use-chess-stream-frame-capture';
import { registerChessStreamSocketHandlers } from './register-chess-stream-socket';
import {
  buildChessStreamSocketConnect,
  StreamAuthRequiredError,
} from '@/lib/chess-stream/ws-socket-auth';
import { useAuthStore } from '@/store/auth-store';
import { notifyError } from '@/lib/notify';
import { useChessStreamLifecycle } from './use-chess-stream-lifecycle';
import type { ChessStreamStreamerControlsProps } from '@/components/chess-stream/chess-stream-streamer-controls';

export type UseChessStreamWebRtcParams = {
  gameToken: string;
  modelPath?: string;
  viewer?: boolean;
  /** Смотреть WebRTC с другого устройства, оставаясь ведущим (кнопки партии). */
  remoteMedia?: boolean;
  initialBoardCalibrated?: boolean;
  initialGameInProgress?: boolean;
  onLocalStreamActive?: () => void;
  setPositionFromFen: (fen: string) => void;
  onGameFinished?: () => void;
};

export function useChessStreamWebRtc({
  gameToken,
  modelPath,
  viewer = false,
  remoteMedia = false,
  initialBoardCalibrated = false,
  initialGameInProgress = false,
  onLocalStreamActive,
  setPositionFromFen,
  onGameFinished,
}: UseChessStreamWebRtcParams) {
  const mediaViewer = viewer || remoteMedia;
  const [localStreaming, setLocalStreaming] = useState(false);
  const localStreamingRef = useRef(false);
  const socketAsViewer = mediaViewer && !localStreaming && !localStreamingRef.current;
  const refs = useChessStreamRefs();
  const {
    videoRef,
    canvasRef,
    socketRef,
    frameIntervalRef,
    streamRef,
    streamBackupRef,
    producerRef,
    consumerRef,
    sendTransportRef,
    recvTransportRef,
    gameStartedRef,
    viewerRef,
  } = refs;

  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const hasVideoStreamRef = useRef(hasVideoStream);
  useEffect(() => {
    hasVideoStreamRef.current = hasVideoStream;
  }, [hasVideoStream]);

  const [calibrationInProgress, setCalibrationInProgress] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(
    initialBoardCalibrated,
  );
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(
    initialBoardCalibrated ? 'Доска откалибрована' : null,
  );
  const [gameStarted, setGameStarted] = useState(initialGameInProgress);
  const [mappingData, setMappingData] = useState<Record<string, unknown> | null>(null);
  const [moves, setMoves] = useState<{ san: string }[]>([]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted, gameStartedRef]);

  useEffect(() => {
    viewerRef.current = socketAsViewer;
  }, [socketAsViewer, viewerRef]);

  useEffect(() => {
    if (initialBoardCalibrated) {
      setCalibrationCompleted(true);
      setCalibrationMessage('Доска откалибрована');
    }
  }, [initialBoardCalibrated]);

  useEffect(() => {
    if (initialGameInProgress) {
      setGameStarted(true);
    }
  }, [initialGameInProgress]);

  const { initMediasoupDevice, createProducer, createConsumer } = useChessStreamMediasoup(
    gameToken,
    refs,
    setHasVideoStream,
  );

  const { startCamera } = useChessStreamCamera(refs, setHasVideoStream);

  const { captureAndSendFrame } = useChessStreamFrameCapture(gameToken, refs, socket);

  const onStreamStoppedRef = useRef<() => void>(() => {});

  const connectWebSocket = useCallback(
    async (opts?: { forceLocalStreamer?: boolean }) => {
    const isViewer = opts?.forceLocalStreamer ? false : socketAsViewer;
    const wsUrl = getWsUrl();
    const { url: socketUrl, ticket } = await buildChessStreamSocketConnect(wsUrl, {
      // remoteMedia на ПК: join-stream с userId; публичный зритель без логина — без тикета
      requireAuth: !isViewer || remoteMedia,
    });
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      secure: /^wss:|^https:/i.test(wsUrl),
      withCredentials: true,
      ...(ticket
        ? {
            query: { token: ticket },
            auth: { ticket },
          }
        : {}),
    });

    registerChessStreamSocketHandlers(newSocket, {
      gameToken,
      modelPath,
      viewer: isViewer,
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
      onStreamStopped: () => onStreamStoppedRef.current(),
      captureAndSendFrame,
      initMediasoupDevice,
      createProducer,
      createConsumer,
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
  },
  [
    gameToken,
    modelPath,
    socketAsViewer,
    remoteMedia,
    refs,
    socketRef,
    captureAndSendFrame,
    initMediasoupDevice,
    createProducer,
    createConsumer,
    setPositionFromFen,
    onGameFinished,
  ]);

  const releaseMediaResources = useCallback(
    (opts?: { keepSocket?: boolean }) => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (producerRef.current) {
        producerRef.current.close();
        producerRef.current = null;
      }
      if (consumerRef.current) {
        consumerRef.current.close();
        consumerRef.current = null;
      }
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }
      if (!remoteMedia && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (!remoteMedia && streamBackupRef.current) {
        streamBackupRef.current.getTracks().forEach((track) => track.stop());
        streamBackupRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        setHasVideoStream(false);
      }
      if (!opts?.keepSocket) {
        const currentSocket = socket || socketRef.current;
        if (currentSocket) {
          currentSocket.disconnect();
          setSocket(null);
          socketRef.current = null;
        }
      }
      setIsStreaming(false);
      setCalibrationInProgress(false);
      setCalibrationCompleted(false);
      setCalibrationMessage(null);
      setGameStarted(false);
    },
    [
      remoteMedia,
      frameIntervalRef,
      producerRef,
      consumerRef,
      sendTransportRef,
      recvTransportRef,
      streamRef,
      streamBackupRef,
      videoRef,
      socket,
      socketRef,
      setHasVideoStream,
    ],
  );

  const handleStreamStopped = useCallback(() => {
    releaseMediaResources({ keepSocket: remoteMedia });
    localStreamingRef.current = false;
    setLocalStreaming(false);
  }, [releaseMediaResources, remoteMedia]);

  useEffect(() => {
    onStreamStoppedRef.current = handleStreamStopped;
  }, [handleStreamStopped]);

  const stopStreaming = useCallback(() => {
    const currentSocket = socket || socketRef.current;
    currentSocket?.emit('stop-stream', { token: gameToken });
    if (remoteMedia) {
      releaseMediaResources({ keepSocket: true });
      return;
    }
    localStreamingRef.current = false;
    setLocalStreaming(false);
    releaseMediaResources();
  }, [
    gameToken,
    remoteMedia,
    socket,
    socketRef,
    releaseMediaResources,
  ]);

  const startStreaming = useCallback(async () => {
    const forceLocal = !viewer;
    if (forceLocal) {
      localStreamingRef.current = true;
      setLocalStreaming(true);
      onLocalStreamActive?.();
      const authState = useAuthStore.getState();
      if (!authState.isHydrated) {
        await authState.hydrate();
      }
      if (!useAuthStore.getState().isAuthenticated) {
        throw new StreamAuthRequiredError();
      }
    }

    try {
      if (!forceLocal && socketAsViewer) {
        await connectWebSocket();
        setIsStreaming(true);
      } else {
        await startCamera();
        setIsStreaming(true);
        await connectWebSocket({ forceLocalStreamer: forceLocal });
      }
    } catch (e) {
      if (e instanceof StreamAuthRequiredError) {
        notifyError(
          'Не удалось авторизовать трансляцию. Выйдите из аккаунта и войдите снова.',
        );
        return;
      }
      throw e;
    }
  }, [viewer, socketAsViewer, startCamera, connectWebSocket, onLocalStreamActive]);

  const handleStartGame = useCallback(() => {
    if (!calibrationCompleted) return;
    setMoves([]);
    const s = socket || socketRef.current;
    s?.emit('start-game', { token: gameToken });
    setGameStarted(true);
  }, [calibrationCompleted, gameToken, socket, socketRef]);

  useChessStreamLifecycle({
    mediaViewer: socketAsViewer,
    remoteMedia,
    gameToken,
    refs,
    socket,
    isStreaming,
    hasVideoStreamRef,
    setHasVideoStream,
    connectWebSocket,
  });

  const streamerControlsProps: Omit<
    ChessStreamStreamerControlsProps,
    'gameFinished' | 'onOpenFinishGame' | 'showControls' | 'canStopStream'
  > = {
    viewer,
    calibrationCompleted,
    gameStarted,
    calibrationInProgress,
    calibrationMessage,
    onStartGame: handleStartGame,
    onStopStreaming: stopStreaming,
  };

  return {
    videoRef,
    canvasRef,
    hasVideoStream,
    setHasVideoStream,
    isStreaming,
    viewer,
    startStreaming,
    stopStreaming,
    handleStartGame,
    calibrationCompleted,
    calibrationInProgress,
    calibrationMessage,
    gameStarted,
    moves,
    streamerControlsProps,
    hasVideoStream,
  };
}
