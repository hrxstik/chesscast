'use client';

import { useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import type { ChessStreamRefs } from './chess-stream-ref-types';

export function useChessStreamMediasoup(
  gameToken: string,
  refs: ChessStreamRefs,
  setError: (msg: string | null) => void,
  setHasVideoStream: (v: boolean) => void,
) {
  const { socketRef, deviceRef, sendTransportRef, recvTransportRef, producerRef, consumerRef, consumerCreatingRef, videoRef, streamRef, streamBackupRef } = refs;

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

  const createProducer = useCallback(
    async (stream: MediaStream) => {
      if (!socketRef.current || !deviceRef.current) {
        throw new Error('Socket or device not initialized');
      }

      socketRef.current.emit('create-transport', {
        token: gameToken,
        direction: 'send',
      });

      const transportData = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Transport creation timeout')), 10000);
        socketRef.current!.once('transport-created', (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        });
        socketRef.current!.once('error', (error: any) => {
          clearTimeout(timeout);
          reject(new Error(error.message));
        });
      });

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
            socketRef.current!.emit('connect-transport', {
              token: gameToken,
              dtlsParameters,
            });
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error('Transport connect timeout')),
                10000,
              );
              socketRef.current!.once('transport-connected', () => {
                clearTimeout(timeout);
                resolve();
              });
              socketRef.current!.once('error', (error: any) => {
                clearTimeout(timeout);
                reject(new Error(error.message));
              });
            });
            callback();
          } catch (error) {
            errback(error as Error);
          }
        },
      );

      sendTransport.on('connectionstatechange', (state) => {
        if (state === 'failed' || state === 'disconnected') {
          setError(`Подключение медиатранспорта: ${state}`);
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
            socketRef.current!.emit('produce', {
              token: gameToken,
              transportId: sendTransport.id,
              rtpParameters,
            });
            const { id } = await new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Produce timeout')), 10000);
              socketRef.current!.once('produced', (data: any) => {
                clearTimeout(timeout);
                resolve(data);
              });
              socketRef.current!.once('error', (error: any) => {
                clearTimeout(timeout);
                reject(new Error(error.message));
              });
            });
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
    [gameToken, socketRef, deviceRef, sendTransportRef, producerRef, setError],
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
        socketRef.current.emit('create-transport', {
          token: gameToken,
          direction: 'recv',
        });

        const transportData = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Transport creation timeout')), 10000);
          socketRef.current!.once('transport-created', (data: any) => {
            clearTimeout(timeout);
            resolve(data);
          });
          socketRef.current!.once('error', (error: any) => {
            clearTimeout(timeout);
            reject(new Error(error.message));
          });
        });

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
              socketRef.current!.emit('connect-transport', {
                token: gameToken,
                dtlsParameters,
              });
              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(
                  () => reject(new Error('Transport connect timeout')),
                  10000,
                );
                socketRef.current!.once('transport-connected', () => {
                  clearTimeout(timeout);
                  resolve();
                });
                socketRef.current!.once('error', (error: any) => {
                  clearTimeout(timeout);
                  reject(new Error(error.message));
                });
              });
              callback();
            } catch (error) {
              errback(error as Error);
            }
          },
        );

        recvTransportRef.current = recvTransport;

        socketRef.current.emit('consume', {
          token: gameToken,
          transportId: recvTransport.id,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        });

        const consumerData = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Consume timeout')), 10000);
          socketRef.current!.once('consumed', (data: any) => {
            clearTimeout(timeout);
            resolve(data);
          });
          socketRef.current!.once('error', (error: any) => {
            clearTimeout(timeout);
            reject(new Error(error.message));
          });
        });

        const consumer = await recvTransport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        consumerRef.current = consumer;
        consumer.track.enabled = true;
        if (consumer.paused) {
          consumer.resume();
        }

        socketRef.current?.emit('resume-consumer', {
          token: gameToken,
          consumerId: consumer.id,
        });

        consumer.on('transportclose', () => {
          setHasVideoStream(false);
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
            setHasVideoStream(false);
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
      setHasVideoStream,
    ],
  );

  return { initMediasoupDevice, createProducer, createConsumer };
}
