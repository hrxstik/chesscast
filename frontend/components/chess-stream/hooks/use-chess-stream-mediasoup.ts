'use client';

import { useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import type { ChessStreamRefs } from './chess-stream-ref-types';
import {
  canStartProducer,
  canStartViewer,
  closeMediasoupConsumer,
  closeMediasoupTransport,
  createMediaSessionState,
} from './chess-stream-media-session';
import {
  type MediasoupConsumedPayload,
  type MediasoupProducedPayload,
  type MediasoupTransportPayload,
} from '../lib/mediasoup-socket.types';
import { waitSocketEvent } from '../lib/socket-once';
import { notifyError } from '@/lib/notify';

export function useChessStreamMediasoup(
  gameToken: string,
  refs: ChessStreamRefs,
  setHasVideoStream: (v: boolean) => void,
) {
  const {
    socketRef,
    deviceRef,
    sendTransportRef,
    recvTransportRef,
    producerRef,
    consumerRef,
    consumerCreatingRef,
    videoRef,
    streamRef,
    streamBackupRef,
    lastProducerIdRef,
    mediaReconnectingRef,
    pendingProducerIdRef,
    mediaSessionRef,
  } = refs;

  const resetMediaSession = useCallback(() => {
    mediaSessionRef.current = createMediaSessionState();
    pendingProducerIdRef.current = null;
    consumerCreatingRef.current = false;
    mediaReconnectingRef.current = false;
  }, [
    mediaSessionRef,
    pendingProducerIdRef,
    consumerCreatingRef,
    mediaReconnectingRef,
  ]);

  const closeRecvSide = useCallback(() => {
    closeMediasoupConsumer(consumerRef.current);
    consumerRef.current = null;
    closeMediasoupTransport(recvTransportRef.current);
    recvTransportRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasVideoStream(false);
    if (
      mediaSessionRef.current.phase === 'viewer-ready' ||
      mediaSessionRef.current.phase === 'viewer-connecting'
    ) {
      mediaSessionRef.current.phase = 'idle';
    }
  }, [consumerRef, recvTransportRef, videoRef, setHasVideoStream, mediaSessionRef]);

  const closeSendSide = useCallback(() => {
    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }
    closeMediasoupTransport(sendTransportRef.current);
    sendTransportRef.current = null;
    if (
      mediaSessionRef.current.phase === 'producer-ready' ||
      mediaSessionRef.current.phase === 'producer-connecting'
    ) {
      mediaSessionRef.current.phase = 'idle';
    }
  }, [producerRef, sendTransportRef, mediaSessionRef]);

  const teardownAllMedia = useCallback(() => {
    mediaSessionRef.current.phase = 'stopping';
    closeRecvSide();
    closeSendSide();
    deviceRef.current = null;
    resetMediaSession();
  }, [closeRecvSide, closeSendSide, deviceRef, mediaSessionRef, resetMediaSession]);

  const initMediasoupDevice = useCallback(
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      if (!deviceRef.current) {
        mediaSessionRef.current.phase = 'device-loading';
        deviceRef.current = new mediasoupClient.Device();
        await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
      }
      if (mediaSessionRef.current.phase === 'device-loading') {
        mediaSessionRef.current.phase = 'idle';
      }
      return deviceRef.current;
    },
    [deviceRef, mediaSessionRef],
  );

  const requestViewerMediaReconnect = useCallback(() => {
    if (mediaReconnectingRef.current) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;

    mediaReconnectingRef.current = true;
    closeRecvSide();
    deviceRef.current = null;
    mediaSessionRef.current.phase = 'device-loading';
    socket.emit('get-router-rtp-capabilities', { token: gameToken });
    window.setTimeout(() => {
      mediaReconnectingRef.current = false;
    }, 2000);
  }, [
    mediaReconnectingRef,
    socketRef,
    closeRecvSide,
    deviceRef,
    mediaSessionRef,
    gameToken,
  ]);

  const createProducer = useCallback(
    async (stream: MediaStream) => {
      if (!socketRef.current || !deviceRef.current) {
        throw new Error('Socket or device not initialized');
      }
      if (producerRef.current) {
        return producerRef.current;
      }
      if (!canStartProducer(mediaSessionRef.current)) {
        return null;
      }

      mediaSessionRef.current.phase = 'producer-connecting';
      const socket = socketRef.current;
      socket.emit('create-transport', { token: gameToken, direction: 'send' });

      const transportData = await waitSocketEvent<MediasoupTransportPayload>(
        socket,
        'transport-created',
      );

      const sendTransport = deviceRef.current.createSendTransport({
        id: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });

      sendTransport.on(
        'connect',
        async (
          { dtlsParameters }: { dtlsParameters: mediasoupClient.types.DtlsParameters },
          callback: () => void,
          errback: (error: Error) => void,
        ) => {
          try {
            socket.emit('connect-transport', {
              token: gameToken,
              transportId: sendTransport.id,
              dtlsParameters,
            });
            await waitSocketEvent(socket, 'transport-connected');
            callback();
          } catch (error) {
            errback(error as Error);
          }
        },
      );

      sendTransport.on('connectionstatechange', (state) => {
        if (state === 'failed' || state === 'disconnected') {
          notifyError(`Отправка видео: ${state}. Проверьте соединение.`);
        }
      });

      sendTransport.on(
        'produce',
        async (
          {
            rtpParameters,
          }: {
            kind: mediasoupClient.types.MediaKind;
            rtpParameters: mediasoupClient.types.RtpParameters;
          },
          callback: (params: { id: string }) => void,
          errback: (error: Error) => void,
        ) => {
          try {
            socket.emit('produce', {
              token: gameToken,
              transportId: sendTransport.id,
              rtpParameters,
            });
            const { id } = await waitSocketEvent<MediasoupProducedPayload>(socket, 'produced');
            callback({ id });
          } catch (error) {
            errback(error as Error);
          }
        },
      );

      sendTransportRef.current = sendTransport;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track in stream');
      }
      if (videoTrack.readyState !== 'live') {
        throw new Error(`Video track is not live: ${videoTrack.readyState}`);
      }
      if (!videoTrack.enabled) {
        videoTrack.enabled = true;
      }

      const producer = await sendTransport.produce({ track: videoTrack });
      producerRef.current = producer;
      mediaSessionRef.current.phase = 'producer-ready';
      if (producer.paused) {
        producer.resume();
      }
      return producer;
    },
    [gameToken, socketRef, deviceRef, sendTransportRef, producerRef, mediaSessionRef],
  );

  const createConsumer = useCallback(
    async (producerId: string) => {
      if (consumerRef.current || consumerCreatingRef.current) {
        return consumerRef.current;
      }
      if (!socketRef.current?.connected) {
        pendingProducerIdRef.current = producerId;
        return null;
      }
      if (!deviceRef.current || !videoRef.current) {
        pendingProducerIdRef.current = producerId;
        return null;
      }
      if (!canStartViewer(mediaSessionRef.current, true, true)) {
        pendingProducerIdRef.current = producerId;
        return null;
      }

      consumerCreatingRef.current = true;
      mediaSessionRef.current.phase = 'viewer-connecting';

      try {
        const socket = socketRef.current;
        socket.emit('create-transport', { token: gameToken, direction: 'recv' });

        const transportData = await waitSocketEvent<MediasoupTransportPayload>(
          socket,
          'transport-created',
        );

        const recvTransport = deviceRef.current.createRecvTransport({
          id: transportData.id,
          iceParameters: transportData.iceParameters,
          iceCandidates: transportData.iceCandidates,
          dtlsParameters: transportData.dtlsParameters,
        });

        recvTransport.on(
          'connect',
          async (
            { dtlsParameters }: { dtlsParameters: mediasoupClient.types.DtlsParameters },
            callback: () => void,
            errback: (error: Error) => void,
          ) => {
            try {
              socket.emit('connect-transport', {
                token: gameToken,
                transportId: recvTransport.id,
                dtlsParameters,
              });
              await waitSocketEvent(socket, 'transport-connected');
              callback();
            } catch (error) {
              errback(error as Error);
            }
          },
        );

        recvTransport.on('connectionstatechange', (state) => {
          if (state === 'failed' || state === 'disconnected') {
            setTimeout(() => requestViewerMediaReconnect(), 500);
          }
        });

        recvTransportRef.current = recvTransport;

        socket.emit('consume', {
          token: gameToken,
          transportId: recvTransport.id,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        });

        const consumerData = await waitSocketEvent<MediasoupConsumedPayload>(socket, 'consumed');

        const consumer = await recvTransport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        consumerRef.current = consumer;
        lastProducerIdRef.current = producerId;
        pendingProducerIdRef.current = null;
        consumer.track.enabled = true;
        if (consumer.paused) {
          consumer.resume();
        }

        socket.emit('resume-consumer', {
          token: gameToken,
          consumerId: consumer.id,
        });

        consumer.on('transportclose', () => {
          requestViewerMediaReconnect();
        });

        const stream = new MediaStream([consumer.track]);
        const video = videoRef.current;

        if (video) {
          streamRef.current = stream;
          streamBackupRef.current = stream;
          video.srcObject = stream;
          setHasVideoStream(true);
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          consumer.track.onended = () => {
            requestViewerMediaReconnect();
          };
          try {
            await video.play();
          } catch {
            setTimeout(() => {
              videoRef.current?.play().catch(() => {});
            }, 100);
          }
        }

        mediaSessionRef.current.phase = 'viewer-ready';
        return consumer;
      } finally {
        consumerCreatingRef.current = false;
      }
    },
    [
      gameToken,
      socketRef,
      deviceRef,
      recvTransportRef,
      consumerRef,
      consumerCreatingRef,
      videoRef,
      streamRef,
      streamBackupRef,
      lastProducerIdRef,
      pendingProducerIdRef,
      mediaSessionRef,
      setHasVideoStream,
      requestViewerMediaReconnect,
    ],
  );

  const tryConsumePending = useCallback(async () => {
    const producerId = pendingProducerIdRef.current;
    if (!producerId || consumerRef.current || consumerCreatingRef.current) {
      return;
    }
    if (!deviceRef.current || !videoRef.current || !socketRef.current?.connected) {
      return;
    }
    try {
      await createConsumer(producerId);
    } catch (error) {
      notifyError(`Ошибка подключения к потоку: ${(error as Error).message}`);
    }
  }, [
    pendingProducerIdRef,
    consumerRef,
    consumerCreatingRef,
    deviceRef,
    videoRef,
    socketRef,
    createConsumer,
  ]);

  return {
    initMediasoupDevice,
    createProducer,
    createConsumer,
    tryConsumePending,
    requestViewerMediaReconnect,
    teardownAllMedia,
    closeRecvSide,
    closeSendSide,
  };
}
