'use client';

import { useCallback } from 'react';
import type { ChessStreamRefs } from './chess-stream-ref-types';
import { CHESS_STREAM_VIDEO_CONSTRAINTS } from '@/components/chess-stream/lib/camera-stream-constraints';

export function useChessStreamCamera(
  refs: ChessStreamRefs,
  setHasVideoStream: (v: boolean) => void,
  setCameraError: (msg: string | null) => void,
) {
  const { videoRef, streamRef, streamBackupRef } = refs;

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Ваш браузер не поддерживает доступ к камере. ' +
            'Для доступа к камере требуется HTTPS или localhost. ' +
            'Попробуйте использовать HTTPS или подключитесь через localhost.',
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: CHESS_STREAM_VIDEO_CONSTRAINTS,
        audio: false,
      });

      if (videoRef.current) {
        const video = videoRef.current;
        streamRef.current = stream;
        streamBackupRef.current = stream;
        video.srcObject = stream;
        setCameraError(null);
        setHasVideoStream(true);

        setTimeout(() => {
          const currentVideo = videoRef.current;
          const currentStream = streamRef.current || streamBackupRef.current;
          if (!currentVideo) return;
          if (!currentVideo.srcObject && currentStream) {
            currentVideo.srcObject = currentStream;
            if (!streamRef.current) {
              streamRef.current = currentStream;
            }
            setHasVideoStream(true);
          }
          if (currentVideo.srcObject) {
            setHasVideoStream(true);
            if (currentVideo.paused) {
              currentVideo.play().catch(() => {});
            }
          } else if (currentStream?.active) {
            currentVideo.srcObject = currentStream;
            streamRef.current = currentStream;
            setHasVideoStream(true);
          }
        }, 500);

        const handleLoadedMetadata = () => {
          setHasVideoStream(true);
          video.play().catch(() => {});
        };
        const handleCanPlay = async () => {
          setHasVideoStream(true);
          try {
            await video.play();
            setHasVideoStream(true);
          } catch {
            /* ignore */
          }
        };
        const handlePlay = () => setHasVideoStream(true);
        const handlePlaying = () => setHasVideoStream(true);

        video.onloadedmetadata = handleLoadedMetadata;
        video.oncanplay = handleCanPlay;
        video.onplay = handlePlay;
        video.onplaying = handlePlaying;
        video.onerror = () => {
          setCameraError('Ошибка воспроизведения видео с камеры');
        };

        setTimeout(async () => {
          if (video.srcObject && video.readyState >= 2) {
            try {
              await video.play();
            } catch {
              /* ignore */
            }
          }
        }, 200);
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Не удалось получить доступ к камере',
      );
    }
  }, [videoRef, streamRef, streamBackupRef, setHasVideoStream, setCameraError]);

  return { startCamera };
}
