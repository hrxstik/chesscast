import type { RefObject } from 'react';
import type * as mediasoupClient from 'mediasoup-client';
import type { Socket } from 'socket.io-client';

/** Все ref’ы WebRTC/стрима в одном объекте — передаём в хуки без проп-дрилинга. */
export type ChessStreamRefs = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  streamRef: RefObject<MediaStream | null>;
  streamBackupRef: RefObject<MediaStream | null>;
  socketRef: RefObject<Socket | null>;
  frameIntervalRef: RefObject<NodeJS.Timeout | null>;
  deviceRef: RefObject<mediasoupClient.types.Device | null>;
  sendTransportRef: RefObject<mediasoupClient.types.Transport | null>;
  recvTransportRef: RefObject<mediasoupClient.types.Transport | null>;
  producerRef: RefObject<mediasoupClient.types.Producer | null>;
  consumerRef: RefObject<mediasoupClient.types.Consumer | null>;
  consumerCreatingRef: RefObject<boolean>;
  /** Последний FEN с сервера (для вывода хода как diff позиций). */
  lastStreamFenRef: RefObject<string | null>;
  gameStartedRef: RefObject<boolean>;
  /** Демо для диплома: не перезаписывать доску с CV */
  skipCvBoardRef: RefObject<boolean>;
  viewerRef: RefObject<boolean>;
  lastProducerIdRef: RefObject<string | null>;
  mediaReconnectingRef: RefObject<boolean>;
  pendingProducerIdRef: RefObject<string | null>;
  mediaSessionRef: RefObject<import('./chess-stream-media-session').ChessStreamMediaSessionState>;
  localStreamingRef: RefObject<boolean>;
};
