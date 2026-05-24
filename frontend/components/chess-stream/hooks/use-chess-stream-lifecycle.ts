'use client';

import { useEffect, type RefObject } from 'react';
import type { ChessStreamRefs } from './chess-stream-ref-types';

/** Поллинг video.srcObject, автоподключение зрителя, размонтирование. */
export function useChessStreamLifecycle(params: {
  mediaViewer: boolean;
  remoteMedia?: boolean;
  gameToken: string;
  refs: ChessStreamRefs;
  socket: import('socket.io-client').Socket | null;
  isStreaming: boolean;
  hasVideoStreamRef: RefObject<boolean>;
  setHasVideoStream: (v: boolean) => void;
  connectWebSocket: () => void | Promise<void>;
  tryConsumePending: () => void | Promise<void>;
}) {
  const {
    mediaViewer,
    remoteMedia = false,
    gameToken,
    refs,
    socket,
    isStreaming,
    hasVideoStreamRef,
    setHasVideoStream,
    connectWebSocket,
    tryConsumePending,
  } = params;
  const {
    videoRef,
    streamRef,
    streamBackupRef,
    consumerRef,
    producerRef,
    socketRef,
    frameIntervalRef,
    localStreamingRef,
  } = refs;

  useEffect(() => {
    const updateVideoState = () => {
      const video = videoRef.current;
      const stream = streamRef.current || streamBackupRef.current;
      if (!video) return;
      const hasStream = !!video.srcObject;
      if (!hasStream && stream && stream.active) {
        video.srcObject = stream;
        if (!streamRef.current && streamBackupRef.current) {
          streamRef.current = streamBackupRef.current;
        }
        setHasVideoStream(true);
        void tryConsumePending();
        return;
      }
      const videoStream = video.srcObject as MediaStream | null;
      if (hasStream && videoStream?.active) {
        if (!hasVideoStreamRef.current) {
          setHasVideoStream(true);
        }
      } else if (!hasStream) {
        if (hasVideoStreamRef.current) {
          if (stream) {
            video.srcObject = stream;
            setHasVideoStream(true);
          } else {
            setHasVideoStream(false);
          }
        }
      }
    };

    updateVideoState();
    const interval = setInterval(updateVideoState, 2000);
    const handleVideoEvent = () => {
      updateVideoState();
      void tryConsumePending();
    };
    const video = videoRef.current;
    if (video) {
      const events = ['loadedmetadata', 'play', 'playing', 'canplay', 'loadeddata'];
      events.forEach((event) => video.addEventListener(event, handleVideoEvent));
      return () => {
        clearInterval(interval);
        const currentVideo = videoRef.current;
        if (currentVideo) {
          events.forEach((event) => currentVideo.removeEventListener(event, handleVideoEvent));
        }
      };
    }
    return () => clearInterval(interval);
  }, [
    videoRef,
    streamRef,
    streamBackupRef,
    hasVideoStreamRef,
    setHasVideoStream,
    tryConsumePending,
  ]);

  useEffect(() => {
    if (mediaViewer && !socket && !isStreaming) {
      void connectWebSocket();
    }
  }, [mediaViewer, socket, isStreaming, connectWebSocket]);

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      const isLocalStreamer =
        !!producerRef.current || (!remoteMedia && !!localStreamingRef.current);
      if (isLocalStreamer) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (streamBackupRef.current) {
          streamBackupRef.current.getTracks().forEach((track) => track.stop());
          streamBackupRef.current = null;
        }
      }
      if (consumerRef.current) {
        consumerRef.current.close();
        consumerRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      const currentSocket = socketRef.current;
      if (currentSocket && isLocalStreamer) {
        currentSocket.emit('stop-stream', { token: gameToken });
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    gameToken,
    remoteMedia,
    frameIntervalRef,
    producerRef,
    streamRef,
    streamBackupRef,
    consumerRef,
    videoRef,
    socketRef,
    localStreamingRef,
  ]);
}
