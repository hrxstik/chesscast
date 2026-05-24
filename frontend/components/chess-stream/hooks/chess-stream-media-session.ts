'use client';

import type * as mediasoupClient from 'mediasoup-client';

/** Единая фаза медиа-сессии — без гонок createProducer/createConsumer. */
export type ChessStreamMediaPhase =
  | 'idle'
  | 'device-loading'
  | 'producer-connecting'
  | 'producer-ready'
  | 'viewer-connecting'
  | 'viewer-ready'
  | 'stopping';

export type ChessStreamMediaSessionState = {
  phase: ChessStreamMediaPhase;
  pendingProducerId: string | null;
};

export function createMediaSessionState(): ChessStreamMediaSessionState {
  return { phase: 'idle', pendingProducerId: null };
}

export function canStartProducer(state: ChessStreamMediaSessionState): boolean {
  return state.phase === 'idle' || state.phase === 'device-loading';
}

export function canStartViewer(
  state: ChessStreamMediaSessionState,
  hasVideoElement: boolean,
  hasDevice: boolean,
): boolean {
  if (!hasVideoElement || !hasDevice) return false;
  return (
    state.phase === 'idle' ||
    state.phase === 'device-loading' ||
    state.phase === 'viewer-connecting'
  );
}

export function closeMediasoupConsumer(consumer: mediasoupClient.types.Consumer | null) {
  if (consumer && !consumer.closed) {
    consumer.close();
  }
}

export function closeMediasoupTransport(
  transport: mediasoupClient.types.Transport | null,
) {
  if (transport && !transport.closed) {
    transport.close();
  }
}
