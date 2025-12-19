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

  // Состояние калибровки
  const [calibrationInProgress, setCalibrationInProgress] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);
  const calibrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);

  // Ручная калибровка (полигон из 4 точек в нормализованных координатах 0..1)
  const [manualMode, setManualMode] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualCorners, setManualCorners] = useState<{ x: number; y: number }[]>([
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
      // Пробуем запросить портретную ориентацию с разными подходами
      // Проблема: некоторые браузеры игнорируют exact constraints или конфликтуют width/height с aspectRatio
      let stream: MediaStream;
      try {
        // Подход 1: Только aspectRatio exact (без width/height exact чтобы избежать конфликтов)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1200, min: 800, max: 1920 },
            height: { ideal: 1600, min: 1000, max: 2560 },
            aspectRatio: { exact: 3 / 4 }, // Соотношение 3:4 (width/height = 0.75) - портретная ориентация
            facingMode: 'environment',
          },
          audio: false,
        });
      } catch (aspectError) {
        console.warn('⚠️ [CAMERA] AspectRatio exact failed, trying without exact:', aspectError);
        try {
          // Подход 2: Без exact, только ideal
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1200 },
              height: { ideal: 1600 },
              aspectRatio: 3 / 4, // Без exact
              facingMode: 'environment',
            },
            audio: false,
          });
        } catch (idealError) {
          console.warn('⚠️ [CAMERA] Ideal constraints failed, using minimal:', idealError);
          // Подход 3: Минимальные constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
            },
            audio: false,
          });
        }
      }

      // Логируем реальное разрешение
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      console.log('📹 [CAMERA] Получено разрешение:', {
        width: settings.width,
        height: settings.height,
        aspectRatio: settings.aspectRatio,
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

  // Захват кадра и отправка на сервер (бинарные данные)
  const captureAndSendFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !socket) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

    // Камера уже запрашивается в портретной ориентации 3:4 (1200x1600)
    // Используем изображение как есть, без поворота
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          const frameUint8 = new Uint8Array(buffer);
          socket.emit('frame', {
            token: gameToken,
            frame: frameUint8,
          });
        });
      },
      'image/jpeg',
      0.8,
    );
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

      // Сбрасываем состояние калибровки
      setCalibrationCompleted(false);
      setCalibrationMessage(null);
      setCalibrationInProgress(false);
      setShowManualHint(false);
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
      // Если авто-калибровка долго не приходит - подсветим ручную
      calibrationTimeoutRef.current = setTimeout(() => {
        if (!calibrationCompleted) {
          setShowManualHint(true);
        }
      }, 8000);

      // Начинаем отправлять кадры (например, 2 FPS для обработки)
      frameIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 500); // 2 FPS
    });

    newSocket.on('calibration-started', (data: { message?: string }) => {
      setCalibrationInProgress(true);
      setCalibrationMessage(data?.message || 'Калибровка доски...');
    });

    newSocket.on('calibration-completed', (data: { message?: string; mappingData?: any }) => {
      setCalibrationInProgress(false);
      setCalibrationCompleted(true);
      setCalibrationMessage(data?.message || 'Калибровка выполнена');
      setShowManualHint(false);
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
      setCalibrationInProgress(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    });

    setSocket(newSocket);
  }, [gameToken, modelPath, captureAndSendFrame, calibrationCompleted]);

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
    setCalibrationInProgress(false);
    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, [socket, gameToken, stopCamera]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopStreaming();
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
    };
  }, [stopStreaming]);

  // Обработка перетаскивания углов полигона
  const handlePointerDownCorner = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragIndex(index);
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    setDragIndex(null);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragIndex === null || !videoRef.current) return;
      const videoEl = videoRef.current;
      const rect = videoEl.getBoundingClientRect();
      const xNorm = (e.clientX - rect.left) / rect.width;
      const yNorm = (e.clientY - rect.top) / rect.height;
      if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) return;
      setManualCorners((prev) =>
        prev.map((c, i) => (i === dragIndex ? { x: xNorm, y: yNorm } : c)),
      );
    },
    [dragIndex],
  );

  // Отправка одного кадра и полигона для ручной калибровки
  const handleManualCalibrate = useCallback(() => {
    if (!socket || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return;

    setManualSubmitting(true);
    setCalibrationMessage('Ручная калибровка...');

    // УБРАЛИ ПОВОРОТЫ - отправляем как есть с камеры
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const cornersPx = manualCorners.map((c) => ({
      x: c.x * canvas.width,
      y: c.y * canvas.height,
    }));

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setManualSubmitting(false);
          return;
        }
        blob.arrayBuffer().then((buffer) => {
          const frameUint8 = new Uint8Array(buffer);
          socket.emit(
            'manual-calibrate',
            {
              token: gameToken,
              frame: frameUint8,
              corners: cornersPx,
            },
            () => {
              // ack не обязателен, но оставим хук
            },
          );
          setManualSubmitting(false);
          setManualMode(false);
        });
      },
      'image/jpeg',
      0.8,
    );
  }, [socket, gameToken, manualCorners]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Видео поток */}
      <div className="flex-1">
        <div
          className="relative bg-black rounded-lg overflow-hidden"
          onPointerMove={manualMode ? handlePointerMove : undefined}
          onPointerUp={manualMode ? handlePointerUp : undefined}
          onPointerLeave={manualMode ? handlePointerUp : undefined}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Оверлей статуса калибровки и LIVE */}
          {isStreaming && (
            <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm">LIVE</div>
              {calibrationInProgress && (
                <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                  {calibrationMessage || 'Калибровка...'}
                </div>
              )}
              {calibrationCompleted && (
                <div className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">
                  Калибровка выполнена
                </div>
              )}
            </div>
          )}

          {/* Оверлей ручной калибровки (полигон) */}
          {isStreaming && manualMode && (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full">
                  <polygon
                    points={manualCorners.map((c) => `${c.x * 100}%,${c.y * 100}%`).join(' ')}
                    fill="rgba(59,130,246,0.15)"
                    stroke="rgba(59,130,246,0.9)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              {manualCorners.map((c, idx) => (
                <div
                  key={idx}
                  onPointerDown={handlePointerDownCorner(idx)}
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-blue-500 border-2 border-white shadow cursor-pointer"
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    touchAction: 'none',
                  }}
                />
              ))}
            </>
          )}

          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Button onClick={startStreaming}>Начать стрим</Button>
            </div>
          )}
        </div>
        {cameraError && <p className="text-red-500 text-sm mt-2">{cameraError}</p>}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="mt-2 flex flex-col gap-2">
          {isStreaming && (
            <Button onClick={stopStreaming} variant="destructive">
              Остановить стрим
            </Button>
          )}
          {isStreaming && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant={manualMode ? 'default' : 'outline'}
                className={showManualHint ? 'border-yellow-400 text-yellow-400' : ''}
                onClick={() => setManualMode((prev) => !prev)}>
                Проблемы с калибровкой? Нажми сюда
              </Button>
              {manualMode && (
                <Button type="button" onClick={handleManualCalibrate} disabled={manualSubmitting}>
                  {manualSubmitting ? 'Отправка...' : 'Подтвердить калибровку'}
                </Button>
              )}
            </div>
          )}
        </div>
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
