'use client';

import { useEffect, type RefObject } from 'react';
import type { ChessStreamRefs } from './chess-stream-ref-types';

/** Поллинг video.srcObject, автоподключение зрителя, get-producers, размонтирование. */
export function useChessStreamLifecycle(params: {
  viewer: boolean;
  gameToken: string;
  refs: ChessStreamRefs;
  socket: import('socket.io-client').Socket | null;
  isStreaming: boolean;
  hasVideoStreamRef: RefObject<boolean>;
  setHasVideoStream: (v: boolean) => void;
  connectWebSocket: () => void | Promise<void>;
}) {
  const {
    viewer,
    gameToken,
    refs,
    socket,
    isStreaming,
    hasVideoStreamRef,
    setHasVideoStream,
    connectWebSocket,
  } = params;
  const { videoRef, streamRef, streamBackupRef, consumerRef, deviceRef, socketRef, frameIntervalRef } = refs;

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
    const handleVideoEvent = () => updateVideoState();
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
  }, [videoRef, streamRef, streamBackupRef, hasVideoStreamRef, setHasVideoStream]);

  useEffect(() => {
    if (viewer && !socket && !isStreaming) {
      void connectWebSocket();
    }
  }, [viewer, socket, isStreaming, connectWebSocket]);

  useEffect(() => {
    if (!viewer || consumerRef.current) return;
    const interval = setInterval(() => {
      if (socketRef.current && !consumerRef.current && deviceRef.current) {
        socketRef.current.emit('get-producers', { token: gameToken });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [viewer, gameToken, consumerRef, deviceRef, socketRef]);

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
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
      }
      const currentSocket = socketRef.current;
      if (currentSocket) {
        currentSocket.emit('stop-stream', { token: gameToken });
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
  }, [gameToken, frameIntervalRef, streamRef, streamBackupRef, videoRef, socketRef]);
}
