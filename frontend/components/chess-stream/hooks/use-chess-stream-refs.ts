'use client';

import { useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import type { ChessStreamRefs } from './chess-stream-ref-types';

export function useChessStreamRefs(): ChessStreamRefs {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamBackupRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const deviceRef = useRef<mediasoupClient.types.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumerRef = useRef<mediasoupClient.types.Consumer | null>(null);
  const consumerCreatingRef = useRef(false);

  const boardStateHistoryRef = useRef<string[]>([]);
  const boardStateStableCountRef = useRef(0);
  const gameStartedRef = useRef(false);
  const viewerRef = useRef(false);
  const lastProducerIdRef = useRef<string | null>(null);
  const mediaReconnectingRef = useRef(false);

  return useMemo(
    () => ({
      videoRef,
      canvasRef,
      streamRef,
      streamBackupRef,
      socketRef,
      frameIntervalRef,
      deviceRef,
      sendTransportRef,
      recvTransportRef,
      producerRef,
      consumerRef,
      consumerCreatingRef,
      boardStateHistoryRef,
      boardStateStableCountRef,
      gameStartedRef,
      viewerRef,
      lastProducerIdRef,
      mediaReconnectingRef,
    }),
    [
      videoRef,
      canvasRef,
      streamRef,
      streamBackupRef,
      socketRef,
      frameIntervalRef,
      deviceRef,
      sendTransportRef,
      recvTransportRef,
      producerRef,
      consumerRef,
      consumerCreatingRef,
      boardStateHistoryRef,
      boardStateStableCountRef,
      gameStartedRef,
      viewerRef,
      lastProducerIdRef,
      mediaReconnectingRef,
    ],
  );
}
