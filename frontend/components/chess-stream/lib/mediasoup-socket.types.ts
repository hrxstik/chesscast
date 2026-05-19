import type * as mediasoupClient from 'mediasoup-client';

export type ChessStreamWsError = { message: string };

export type MediasoupTransportPayload = {
  id: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
};

export type MediasoupProducedPayload = { id: string };

export type MediasoupConsumedPayload = {
  id: string;
  producerId: string;
  kind: mediasoupClient.types.MediaKind;
  rtpParameters: mediasoupClient.types.RtpParameters;
};

export type MediasoupProducerInfo = { id: string; kind: string };
