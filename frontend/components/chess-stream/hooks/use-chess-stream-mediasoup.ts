'use client';

import { useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import type { ChessStreamRefs } from './chess-stream-ref-types';
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
    viewerRef,
  } = refs;

  const initMediasoupDevice = useCallback(
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      if (!deviceRef.current) {
        deviceRef.current = new mediasoupClient.Device();
        await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
      }
      return deviceRef.current;
    },
    [deviceRef],
  );

  const closeRecvSide = useCallback(() => {
    if (consumerRef.current) {
      consumerRef.current.close();
      consumerRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasVideoStream(false);
  }, [consumerRef, recvTransportRef, videoRef, setHasVideoStream]);

  const requestViewerMediaReconnect = useCallback(() => {
    if (!viewerRef.current || mediaReconnectingRef.current) return;
    const socket = socketRef.current;
    if (!socket?.connected) return;

    mediaReconnectingRef.current = true;
    closeRecvSide();
    socket.emit('get-producers', { token: gameToken });
    window.setTimeout(() => {
      mediaReconnectingRef.current = false;
    }, 2000);
  }, [viewerRef, mediaReconnectingRef, socketRef, closeRecvSide, gameToken]);

  const createProducer = useCallback(
    async (stream: MediaStream) => {
      if (!socketRef.current || !deviceRef.current) {
        throw new Error('Socket or device not initialized');
      }

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
            socket.emit('connect-transport', { token: gameToken, dtlsParameters });
            await waitSocketEvent(socket, 'transport-connected');
            callback();
          } catch (error) {
            errback(error as Error);
          }
        },
      );

      sendTransport.on('connectionstatechange', (state) => {
        if (state === 'failed' || state === 'disconnected') {
          notifyError(`Отправка видео: ${state}. Переподключение…`);
          socket.emit('start-stream', { token: gameToken });
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
      if (producer.paused) {
        producer.resume();
      }
      return producer;
    },
    [gameToken, socketRef, deviceRef, sendTransportRef, producerRef],
  );

  const createConsumer = useCallback(
    async (producerId: string) => {
      if (!socketRef.current || !deviceRef.current || !videoRef.current) {
        throw new Error('Socket, device or video element not initialized');
      }
      if (consumerCreatingRef.current) {
        return;
      }
      consumerCreatingRef.current = true;

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
              socket.emit('connect-transport', { token: gameToken, dtlsParameters });
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
      setHasVideoStream,
      requestViewerMediaReconnect,
    ],
  );

  return { initMediasoupDevice, createProducer, createConsumer, requestViewerMediaReconnect };
}
