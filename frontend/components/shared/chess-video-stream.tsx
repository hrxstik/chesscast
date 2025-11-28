'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '@/lib/hooks/useEngine';
import { Button } from '@/components/ui/button';

interface ChessVideoStreamProps {
  gameToken: string;
  modelPath?: string;
}

export const ChessVideoStream: React.FC<ChessVideoStreamProps> = ({ gameToken, modelPath }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
  } = useEngine();

  // Инициализация камеры
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Минимум 480p, максимум 720p
          width: { min: 640, ideal: 854, max: 1280 },
          height: { min: 480, ideal: 480, max: 720 },
          aspectRatio: { ideal: 16 / 9 }, // Сохраняем пропорции
          facingMode: 'environment', // Задняя камера на мобильных
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraError(null);
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Не удалось получить доступ к камере');
      console.error('Camera error:', err);
    }
  }, []);

  // Остановка камеры
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Захват кадра и отправка на сервер
  const captureAndSendFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !socket) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Устанавливаем размеры canvas равными видео
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Рисуем кадр на canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Конвертируем в base64 (в будущем можно использовать бинарные данные)
    const frameData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Отправляем кадр на сервер
    socket.emit('frame', {
      token: gameToken,
      frame: frameData,
    });
  }, [socket, gameToken]);

  // Подключение к WebSocket
  const connectWebSocket = useCallback(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const newSocket = io(`${wsUrl}/chess-stream`, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setError(null);

      // Запускаем стрим
      newSocket.emit('start-stream', {
        token: gameToken,
        modelPath,
      });
    });

    newSocket.on('stream-started', () => {
      console.log('Stream started');
      setIsStreaming(true);

      // Начинаем отправлять кадры (например, 2 FPS для обработки)
      frameIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 500); // 2 FPS
    });

    newSocket.on('frame-processed', (data: any) => {
      console.log('Frame processed:', data);

      // Обновляем виртуальную доску если есть ход
      if (data.move) {
        // Здесь можно обновить позицию на доске
        console.log('Move detected:', data.move);
      }
    });

    newSocket.on('error', (error: { message: string }) => {
      setError(error.message);
      console.error('WebSocket error:', error);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsStreaming(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    });

    setSocket(newSocket);
  }, [gameToken, modelPath, captureAndSendFrame]);

  // Запуск стриминга
  const startStreaming = useCallback(async () => {
    await startCamera();
    connectWebSocket();
  }, [startCamera, connectWebSocket]);

  // Остановка стриминга
  const stopStreaming = useCallback(() => {
    if (socket) {
      socket.emit('stop-stream', { token: gameToken });
      socket.disconnect();
      setSocket(null);
    }
    stopCamera();
    setIsStreaming(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, [socket, gameToken, stopCamera]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Видео поток */}
      <div className="flex-1">
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />
          <canvas ref={canvasRef} className="hidden" />
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Button onClick={startStreaming}>Начать стрим</Button>
            </div>
          )}
          {isStreaming && (
            <div className="absolute top-2 right-2">
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm">LIVE</div>
            </div>
          )}
        </div>
        {cameraError && <p className="text-red-500 text-sm mt-2">{cameraError}</p>}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {isStreaming && (
          <Button onClick={stopStreaming} className="mt-2" variant="destructive">
            Остановить стрим
          </Button>
        )}
      </div>

      {/* Виртуальная доска и анализ */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <Chessboard options={chessboardOptions} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Engine: </span>
              {engineReady ? 'Ready' : 'Loading...'}
            </div>
            <div>
              <span className="font-semibold">Evaluation: </span>
              {possibleMate ? `#${possibleMate}` : positionEvaluation}
            </div>
            <div>
              <span className="font-semibold">Depth: </span>
              {depth}
            </div>
            <div>
              <span className="font-semibold">Best line: </span>
              <i>{bestLine.slice(0, 40)}...</i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
