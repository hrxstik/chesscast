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

export const ChessVideoStreamWebRTC: React.FC<ChessVideoStreamProps> = ({
  gameToken,
  modelPath,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasVideoStream, setHasVideoStream] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Дополнительное хранилище потока для надежности
  const streamBackupRef = useRef<MediaStream | null>(null);
  // Ref для socket, чтобы иметь доступ к актуальному значению в cleanup
  const socketRef = useRef<Socket | null>(null);

  const {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
  } = useEngine();

  // Захват кадра и отправка бинарных данных
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

    // Конвертируем в JPEG бинарные данные
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        // Читаем blob как ArrayBuffer и отправляем бинарные данные
        blob.arrayBuffer().then((buffer) => {
          // Отправляем бинарные данные через WebSocket
          // Socket.IO автоматически обрабатывает ArrayBuffer
          socket.emit('frame', {
            token: gameToken,
            frame: new Uint8Array(buffer),
          });
        });
      },
      'image/jpeg',
      0.8,
    );
  }, [socket, gameToken]);

  // Инициализация камеры
  const startCamera = useCallback(async () => {
    try {
      // Проверка поддержки getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg =
          'Ваш браузер не поддерживает доступ к камере. ' +
          'Для доступа к камере требуется HTTPS или localhost. ' +
          'Попробуйте использовать HTTPS или подключитесь через localhost.';
        setCameraError(errorMsg);
        console.error('getUserMedia not supported:', {
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
          isSecureContext: window.isSecureContext,
          protocol: window.location.protocol,
        });
        return;
      }

      console.log('Requesting camera access...', {
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
      });
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
      console.log('Camera stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());

      if (videoRef.current) {
        const video = videoRef.current;

        // Устанавливаем поток
        // Сохраняем поток в refs ПЕРЕД установкой в video (двойное сохранение для надежности)
        streamRef.current = stream;
        streamBackupRef.current = stream; // Дополнительная копия
        video.srcObject = stream;
        setCameraError(null);

        // Двойная проверка что поток установлен
        console.log('✅ Stream assigned to video element:', {
          hasSrcObject: !!video.srcObject,
          streamActive: stream.active,
          videoTracks: stream.getVideoTracks().length,
          videoElement: video,
          videoReadyState: video.readyState,
          streamRefSet: !!streamRef.current,
          streamBackupSet: !!streamBackupRef.current,
        });

        // Принудительно обновляем состояние
        setHasVideoStream(true);
        console.log('✅ hasVideoStream set to true immediately');

        // Дополнительная проверка и восстановление через небольшую задержку
        setTimeout(() => {
          const currentVideo = videoRef.current;
          const currentStream = streamRef.current || streamBackupRef.current; // Используем backup если основной потерян

          if (!currentVideo) {
            console.error('❌ Delayed check: video element is null!');
            return;
          }

          // Если srcObject потерян, но поток есть в ref - восстанавливаем
          if (!currentVideo.srcObject && currentStream) {
            console.warn('⚠️ srcObject lost, restoring from streamRef...', {
              hasStreamRef: !!streamRef.current,
              hasStreamBackup: !!streamBackupRef.current,
              streamActive: currentStream.active,
            });
            currentVideo.srcObject = currentStream;
            // Восстанавливаем refs если они потеряны
            if (!streamRef.current) {
              streamRef.current = currentStream;
            }
            setHasVideoStream(true);
          }

          if (currentVideo.srcObject) {
            console.log('✅ Delayed check: srcObject exists', {
              hasSrcObject: !!currentVideo.srcObject,
              readyState: currentVideo.readyState,
              videoWidth: currentVideo.videoWidth,
              videoHeight: currentVideo.videoHeight,
              paused: currentVideo.paused,
            });
            setHasVideoStream(true);

            // Принудительно запускаем воспроизведение если еще не играет
            if (currentVideo.paused) {
              currentVideo.play().catch((err) => {
                console.error('Error playing in delayed check:', err);
              });
            }
          } else {
            console.error('❌ Delayed check: srcObject lost and no stream in refs!', {
              hasVideo: !!currentVideo,
              hasSrcObject: !!currentVideo?.srcObject,
              hasStreamRef: !!streamRef.current,
              hasStreamBackup: !!streamBackupRef.current,
            });
            // Последняя попытка - проверяем, не остановился ли поток
            if (currentStream && currentStream.active) {
              console.warn('⚠️ Stream still active, forcing restore...');
              currentVideo.srcObject = currentStream;
              streamRef.current = currentStream;
              setHasVideoStream(true);
            }
          }
        }, 500);

        // Обрабатываем события загрузки видео
        const handleLoadedMetadata = () => {
          console.log('✅ Video metadata loaded:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            srcObject: !!video.srcObject,
            readyState: video.readyState,
          });
          setHasVideoStream(true);

          // Принудительно запускаем воспроизведение
          video.play().catch((err) => {
            console.error('Error playing in handleLoadedMetadata:', err);
          });
        };

        const handleCanPlay = async () => {
          console.log('✅ Video can play, readyState:', video.readyState);
          setHasVideoStream(true);

          // Запускаем воспроизведение только один раз
          try {
            await video.play();
            console.log('✅ Video playing successfully');
            setHasVideoStream(true);
          } catch (err) {
            console.error('Error playing video:', err);
          }
        };

        const handlePlay = () => {
          console.log('✅ Video play event fired');
          setHasVideoStream(true);
        };

        const handlePlaying = () => {
          console.log('✅ Video playing event fired - video is actually playing!');
          setHasVideoStream(true);
        };

        // Устанавливаем обработчики
        video.onloadedmetadata = handleLoadedMetadata;
        video.oncanplay = handleCanPlay;
        video.onplay = handlePlay;
        video.onplaying = handlePlaying;

        // Также обрабатываем ошибки
        video.onerror = (e) => {
          console.error('❌ Video error:', e);
        };

        // Пытаемся запустить воспроизведение после небольшой задержки
        // чтобы дать браузеру время установить поток
        setTimeout(async () => {
          if (video.srcObject && video.readyState >= 2) {
            try {
              await video.play();
              console.log('Video play() called successfully after timeout');
            } catch (err) {
              console.error('Error calling play() after timeout:', err);
            }
          }
        }, 200);
      } else {
        console.error('videoRef.current is null');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Не удалось получить доступ к камере';
      setCameraError(errorMessage);
      console.error('Camera error:', err);
    }
  }, []);

  // Подключение к WebSocket
  const connectWebSocket = useCallback(() => {
    // URL для WebSocket (порт бэкенда, обычно 5000)
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';
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

      // Начинаем отправлять кадры (2 FPS для обработки)
      frameIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 500); // 2 FPS
    });

    newSocket.on('calibration-started', (data: { message: string }) => {
      console.log('Calibration started:', data.message);
      setError(null); // Очищаем предыдущие ошибки
    });

    newSocket.on('calibration-completed', (data: { message: string; mappingData?: any }) => {
      console.log('Calibration completed:', data.message);
      setError(null);
    });

    newSocket.on('frame-processed', (data: any) => {
      console.log('Frame processed:', data);
      if (data.move) {
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
    socketRef.current = newSocket; // Сохраняем в ref для cleanup
  }, [gameToken, modelPath, captureAndSendFrame]);

  // Остановка стриминга
  const stopStreaming = useCallback(() => {
    console.log('🛑 stopStreaming called', {
      hasStreamRef: !!streamRef.current,
      hasStreamBackup: !!streamBackupRef.current,
      hasVideoSrcObject: !!videoRef.current?.srcObject,
    });

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
      setHasVideoStream(false);
    }

    const currentSocket = socket || socketRef.current;
    if (currentSocket) {
      currentSocket.emit('stop-stream', { token: gameToken });
      currentSocket.disconnect();
      setSocket(null);
      socketRef.current = null;
    }

    setIsStreaming(false);
  }, [socket, gameToken]);

  // Запуск стриминга
  const startStreaming = useCallback(async () => {
    await startCamera();
    connectWebSocket();
  }, [startCamera, connectWebSocket]);

  // Отслеживание изменений videoRef для обновления состояния
  useEffect(() => {
    const updateVideoState = () => {
      // Всегда проверяем актуальный videoRef, а не замыкание
      const video = videoRef.current;
      const stream = streamRef.current || streamBackupRef.current; // Используем backup если основной потерян

      if (!video) {
        return;
      }

      const hasStream = !!video.srcObject;

      // Если srcObject потерян, но поток есть в ref - восстанавливаем
      if (!hasStream && stream && stream.active) {
        console.warn('⚠️ srcObject lost in updateVideoState, restoring...', {
          hasStreamRef: !!streamRef.current,
          hasStreamBackup: !!streamBackupRef.current,
          streamActive: stream.active,
        });
        video.srcObject = stream;
        // Восстанавливаем refs если они потеряны
        if (!streamRef.current && streamBackupRef.current) {
          streamRef.current = streamBackupRef.current;
        }
        setHasVideoStream(true);
        return;
      }

      const videoStream = video.srcObject as MediaStream | null;

      // Всегда логируем для отладки, но реже
      const shouldLog = hasStream || hasVideoStream;

      if (hasStream && videoStream?.active) {
        if (shouldLog) {
          console.log('✅ Video state check:', {
            hasStream,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            paused: video.paused,
            streamActive: videoStream?.active,
            streamVideoTracks: videoStream?.getVideoTracks().length || 0,
            currentHasVideoStream: hasVideoStream,
          });
        }
        if (!hasVideoStream) {
          setHasVideoStream(true);
        }
      } else if (!hasStream) {
        if (hasVideoStream) {
          // Логируем только если состояние изменилось
          console.log('⚠️ Video stream lost', {
            hasStream,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            hasStreamRef: !!stream,
          });
          // Не сбрасываем состояние если поток есть в ref - попробуем восстановить
          if (stream) {
            video.srcObject = stream;
            setHasVideoStream(true);
          } else {
            setHasVideoStream(false);
          }
        }
      }
    };

    // Проверяем при монтировании
    updateVideoState();

    // Проверяем реже, чтобы не спамить консоль
    const interval = setInterval(updateVideoState, 2000);

    // Отслеживаем события видео - используем делегирование через videoRef
    // Не используем замыкание на video, так как оно может быть устаревшим
    const handleVideoEvent = () => {
      updateVideoState();
    };

    const video = videoRef.current;
    if (video) {
      const events = ['loadedmetadata', 'play', 'playing', 'canplay', 'loadeddata'];
      events.forEach((event) => {
        video.addEventListener(event, handleVideoEvent);
      });

      return () => {
        clearInterval(interval);
        // Удаляем обработчики с актуального элемента
        const currentVideo = videoRef.current;
        if (currentVideo) {
          events.forEach((event) => {
            currentVideo.removeEventListener(event, handleVideoEvent);
          });
        }
      };
    }

    return () => {
      clearInterval(interval);
    };
  }, []); // Убираем hasVideoStream из зависимостей, чтобы не пересоздавать эффект

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Используем прямые ссылки на refs, чтобы не зависеть от stopStreaming
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

      // Отключаем socket если он есть
      const currentSocket = socketRef.current;
      if (currentSocket) {
        currentSocket.emit('stop-stream', { token: gameToken });
        currentSocket.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив зависимостей - выполняется только при размонтировании

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Видео поток */}
      <div className="flex-1">
        <div
          className="relative bg-black rounded-lg overflow-hidden"
          style={{ minHeight: '400px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto max-h-[600px] object-contain"
            style={{
              // Показываем видео если есть поток
              // Используем состояние или проверяем srcObject напрямую
              display: hasVideoStream || !!videoRef.current?.srcObject ? 'block' : 'none',
              backgroundColor: '#000',
              minHeight: '300px',
            }}
            onLoadedMetadata={() => {
              console.log('✅ JSX onLoadedMetadata fired');
              setHasVideoStream(true);
              if (videoRef.current) {
                videoRef.current.play().catch((err) => {
                  console.error('Error playing in onLoadedMetadata:', err);
                });
              }
            }}
            onCanPlay={() => {
              console.log('✅ JSX onCanPlay fired');
              setHasVideoStream(true);
            }}
            onPlay={() => {
              console.log('✅ JSX onPlay fired');
              setHasVideoStream(true);
            }}
            onPlaying={() => {
              console.log('✅ JSX onPlaying fired - video is playing!');
              setHasVideoStream(true);
            }}
            onLoadedData={() => {
              console.log('✅ JSX onLoadedData fired');
              setHasVideoStream(true);
            }}
            onError={(e) => {
              console.error('❌ JSX Video error:', e);
            }}
          />
          {!hasVideoStream && !videoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <p className="mb-4">Видео не запущено</p>
                {!isStreaming && <Button onClick={startStreaming}>Начать стрим</Button>}
              </div>
            </div>
          )}
          {hasVideoStream && videoRef.current?.srcObject && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-10">
              Камера активна
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {isStreaming && hasVideoStream && (
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
