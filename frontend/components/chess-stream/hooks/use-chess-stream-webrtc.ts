'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { io } from 'socket.io-client';
import { getWsUrl } from '@/lib/utils';
import { videoElementClickToSourceCoords } from '@/components/chess-stream/lib/video-element-click-to-source';
import { transformPointToWarped } from '@/components/chess-stream/lib/transform-perspective-point';
import { useChessStreamRefs } from './use-chess-stream-refs';
import { useChessStreamMediasoup } from './use-chess-stream-mediasoup';
import { useChessStreamCamera } from './use-chess-stream-camera';
import { useChessStreamFrameCapture } from './use-chess-stream-frame-capture';
import { registerChessStreamSocketHandlers } from './register-chess-stream-socket';
import { useChessStreamLifecycle } from './use-chess-stream-lifecycle';
import type { ChessStreamStreamerControlsProps } from '@/components/chess-stream/chess-stream-streamer-controls';

export type UseChessStreamWebRtcParams = {
  gameToken: string;
  modelPath?: string;
  viewer?: boolean;
  setPositionFromFen: (fen: string) => void;
};

export function useChessStreamWebRtc({
  gameToken,
  modelPath,
  viewer = false,
  setPositionFromFen,
}: UseChessStreamWebRtcParams) {
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
    a1SettingRef,
  } = refs;

  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const hasVideoStreamRef = useRef(hasVideoStream);
  useEffect(() => {
    hasVideoStreamRef.current = hasVideoStream;
  }, [hasVideoStream]);

  const [calibrationInProgress, setCalibrationInProgress] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [mappingData, setMappingData] = useState<Record<string, unknown> | null>(null);
  const [a1SelectionMode, setA1SelectionMode] = useState(false);
  const [a1Setting, setA1Setting] = useState(false);
  const [moves, setMoves] = useState<{ san: string; uci: string }[]>([]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted, gameStartedRef]);

  useEffect(() => {
    viewerRef.current = viewer;
  }, [viewer, viewerRef]);

  useEffect(() => {
    a1SettingRef.current = a1Setting;
  }, [a1Setting, a1SettingRef]);

  const { initMediasoupDevice, createProducer, createConsumer } = useChessStreamMediasoup(
    gameToken,
    refs,
    setError,
    setHasVideoStream,
  );

  const { startCamera } = useChessStreamCamera(refs, setHasVideoStream, setCameraError);

  const { captureAndSendFrame } = useChessStreamFrameCapture(gameToken, refs, socket);

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWsUrl();
    const newSocket = io(`${wsUrl}/chess-stream`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      secure: wsUrl.startsWith('https://'),
    });

    registerChessStreamSocketHandlers(newSocket, {
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
      setA1Setting,
      setA1SelectionMode,
      setPositionFromFen,
      captureAndSendFrame,
      initMediasoupDevice,
      createProducer,
      createConsumer,
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
  }, [
    gameToken,
    modelPath,
    viewer,
    refs,
    socketRef,
    captureAndSendFrame,
    initMediasoupDevice,
    createProducer,
    createConsumer,
    setPositionFromFen,
  ]);

  const stopStreaming = useCallback(() => {
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (streamBackupRef.current) {
      streamBackupRef.current.getTracks().forEach((track) => track.stop());
      streamBackupRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      setHasVideoStream(false);
    }
    const currentSocket = socket || socketRef.current;
    if (currentSocket) {
      currentSocket.emit('stop-stream', { token: gameToken });
      currentSocket.disconnect();
      setSocket(null);
      socketRef.current = null;
    }
    setIsStreaming(false);
    setCalibrationInProgress(false);
    setCalibrationCompleted(false);
    setCalibrationMessage(null);
    setGameStarted(false);
  }, [
    socket,
    gameToken,
    frameIntervalRef,
    producerRef,
    consumerRef,
    sendTransportRef,
    recvTransportRef,
    streamRef,
    streamBackupRef,
    videoRef,
    socketRef,
    setHasVideoStream,
  ]);

  const startStreaming = useCallback(async () => {
    if (viewer) {
      connectWebSocket();
    } else {
      await startCamera();
      connectWebSocket();
    }
  }, [viewer, startCamera, connectWebSocket]);

  const handleStartGame = useCallback(() => {
    if (!calibrationCompleted) return;
    setMoves([]);
    setGameStarted(true);
  }, [calibrationCompleted]);

  const handleVideoClick = useCallback(
    (e: MouseEvent<HTMLVideoElement>) => {
      const sock = socketRef.current || socket;
      if (!a1SelectionMode || !mappingData || !sock || a1Setting) {
        return;
      }
      const video = e.currentTarget;
      const coords = videoElementClickToSourceCoords(video, e.clientX, e.clientY);
      if (!coords) return;
      const { imgX, imgY } = coords;
      const matrix = mappingData.perspective_matrix as number[][] | undefined;
      if (matrix) {
        const warpedCoords = transformPointToWarped(imgX, imgY, matrix);
        if (warpedCoords) {
          setA1Setting(true);
          sock.emit('set-a1', {
            token: gameToken,
            x: warpedCoords[0],
            y: warpedCoords[1],
          });
        }
      }
    },
    [a1SelectionMode, mappingData, socket, gameToken, a1Setting, socketRef],
  );

  useChessStreamLifecycle({
    viewer,
    gameToken,
    refs,
    socket,
    isStreaming,
    hasVideoStreamRef,
    setHasVideoStream,
    connectWebSocket,
  });

  const streamerControlsProps: ChessStreamStreamerControlsProps = {
    cameraError,
    error,
    viewer,
    isStreaming,
    calibrationCompleted,
    gameStarted,
    calibrationInProgress,
    calibrationMessage,
    mappingData,
    a1SelectionMode,
    a1Setting,
    onStartGame: handleStartGame,
    onStopStreaming: stopStreaming,
    onStartA1Selection: () => setA1SelectionMode(true),
  };

  return {
    videoRef,
    canvasRef,
    handleVideoClick,
    hasVideoStream,
    setHasVideoStream,
    isStreaming,
    viewer,
    startStreaming,
    stopStreaming,
    handleStartGame,
    a1SelectionMode,
    setA1SelectionMode,
    a1Setting,
    setA1Setting,
    mappingData,
    calibrationCompleted,
    calibrationInProgress,
    calibrationMessage,
    gameStarted,
    moves,
    streamerControlsProps,
  };
}
