'use client';

import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChessStreamRefs } from './chess-stream-ref-types';

export function useChessStreamFrameCapture(
  gameToken: string,
  refs: ChessStreamRefs,
  socket: Socket | null,
) {
  const { videoRef, canvasRef, socketRef } = refs;

  const captureAndSendFrame = useCallback(() => {
    const currentSocket = socketRef.current || socket;
    if (!videoRef.current || !canvasRef.current || !currentSocket) {
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          const frameData = new Uint8Array(buffer);
          currentSocket.emit('frame', {
            token: gameToken,
            frame: frameData,
          });
        });
      },
      'image/jpeg',
      0.8,
    );
  }, [socket, gameToken, videoRef, canvasRef, socketRef]);

  return { captureAndSendFrame };
}
