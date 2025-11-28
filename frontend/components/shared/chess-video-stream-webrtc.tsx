'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '@/lib/hooks/useEngine';
import { Button } from '@/components/ui/button';

interface ChessVideoStreamProps {
  gameToken: string;
  modelPath?: string;
  viewer?: boolean; // Режим просмотра (не стримит, только получает кадры)
}

export const ChessVideoStreamWebRTC: React.FC<ChessVideoStreamProps> = ({
  gameToken,
  modelPath,
  viewer = false,
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
    // Используем socketRef вместо socket, чтобы всегда иметь актуальное значение
    const currentSocket = socketRef.current || socket;

    if (!videoRef.current || !canvasRef.current || !currentSocket) {
      console.warn('⚠️ [STREAMER] Cannot capture frame:', {
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
        hasSocket: !!currentSocket,
        hasSocketRef: !!socketRef.current,
        hasSocketState: !!socket,
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.warn('⚠️ [STREAMER] Cannot get canvas context');
      return;
    }

    // Проверяем, что видео готово
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn('⚠️ [STREAMER] Video not ready:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
      });
      return;
    }

    // Устанавливаем размеры canvas равными видео
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Рисуем кадр на canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Конвертируем в JPEG бинарные данные
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.warn('⚠️ [STREAMER] Failed to create blob from canvas');
          return;
        }

        // Читаем blob как ArrayBuffer и отправляем бинарные данные
        blob.arrayBuffer().then((buffer) => {
          const frameData = new Uint8Array(buffer);
          console.log('📹 [STREAMER] Sending frame', {
            token: gameToken,
            frameSize: frameData.length,
            videoSize: `${video.videoWidth}x${video.videoHeight}`,
          });
          // Отправляем бинарные данные через WebSocket
          // Socket.IO автоматически обрабатывает ArrayBuffer
          currentSocket.emit('frame', {
            token: gameToken,
            frame: frameData,
          });
        });
      },
      'image/jpeg',
      0.8,
    );
  }, [socket, gameToken]); // socket оставляем для реактивности, но используем socketRef внутри

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
    // URL для WebSocket
    // Если задана переменная окружения, используем её
    // Иначе определяем автоматически на основе текущего хоста
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (!wsUrl && typeof window !== 'undefined') {
      // Автоматически определяем URL на основе текущего хоста
      const host = window.location.hostname;
      // Для WebSocket используем ws:// для HTTP и wss:// для HTTPS
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      // Предполагаем, что бэкенд на порту 5000
      wsUrl = `${protocol}//${host}:5000`;
    }

    // Fallback на localhost если ничего не определено
    if (!wsUrl) {
      wsUrl = 'http://localhost:5000';
    }

    // Конвертируем http:// в ws:// и https:// в wss:// для Socket.IO
    // Socket.IO должен делать это автоматически, но иногда нужно явно указать
    let socketUrl = wsUrl;
    if (wsUrl.startsWith('http://')) {
      socketUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      socketUrl = wsUrl.replace('https://', 'wss://');
    }

    console.log('🔌 Connecting to WebSocket:', `${socketUrl}/chess-stream`);

    const newSocket = io(`${wsUrl}/chess-stream`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // Явно указываем, что для http:// нужно использовать ws://
      secure: wsUrl.startsWith('https://'),
    });

    // Регистрируем обработчик video-frame ДО подключения, чтобы не пропустить кадры
    // Обработчик для получения видеокадров (режим просмотра)
    newSocket.on('video-frame', (data: { token: string; frame: string }) => {
      console.log('📹 [VIEWER] Received video-frame event', {
        token: data.token,
        expectedToken: gameToken,
        frameLength: data.frame?.length,
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
      });

      if (!videoRef.current || !canvasRef.current) {
        console.warn('⚠️ Video or canvas ref is null');
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
      }

      // Создаем изображение из base64
      const img = new Image();
      img.onload = () => {
        console.log('✅ Frame image loaded', {
          width: img.width,
          height: img.height,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        });

        // Устанавливаем размеры canvas равными изображению
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
          console.log('📐 Canvas resized', {
            width: canvas.width,
            height: canvas.height,
          });
        }

        // Рисуем изображение на canvas
        ctx.drawImage(img, 0, 0);

        // Если еще не создан поток из canvas, создаем его
        if (!video.srcObject) {
          try {
            console.log('🎬 Creating MediaStream from canvas');
            // Создаем MediaStream из canvas
            // Используем 2 FPS, так как кадры приходят с такой частотой
            const stream = canvas.captureStream(2);
            video.srcObject = stream;
            setHasVideoStream(true);
            console.log('✅ Stream assigned to video, attempting to play');

            // Убеждаемся, что video элемент настроен правильно
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;

            video
              .play()
              .then(() => {
                console.log('✅ Video playing successfully');
              })
              .catch((err) => {
                console.error('❌ Error playing video stream:', err);
                // Пытаемся еще раз после небольшой задержки
                setTimeout(() => {
                  video.play().catch((e) => {
                    console.error('❌ Retry play failed:', e);
                  });
                }, 100);
              });
          } catch (err) {
            console.error('❌ Error creating stream from canvas:', err);
            // Если captureStream не поддерживается, это критическая ошибка
            setError('Ваш браузер не поддерживает отображение видеопотока');
          }
        } else {
          // Поток уже создан, canvas обновляется автоматически
          // Canvas.captureStream() автоматически подхватывает изменения canvas
          console.log('🔄 Canvas updated, stream should update automatically');
        }
      };
      img.onerror = (err) => {
        console.error('❌ Error loading frame image:', err);
      };
      img.src = `data:image/jpeg;base64,${data.frame}`;
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected', { viewer, gameToken });
      setError(null);

      if (viewer) {
        // Режим просмотра - присоединяемся к комнате
        console.log('👀 [VIEWER] Joining stream room for token:', gameToken);
        newSocket.emit('join-stream', {
          token: gameToken,
        });
        setIsStreaming(true); // Помечаем как активный просмотр
      } else {
        // Режим стримера - запускаем стрим
        console.log('📹 [STREAMER] Starting stream for token:', gameToken);
        newSocket.emit('start-stream', {
          token: gameToken,
          modelPath,
        });
      }
    });

    newSocket.on('stream-started', () => {
      console.log('Stream started');
      setIsStreaming(true);

      if (!viewer) {
        // Начинаем отправлять кадры только если не в режиме просмотра
        frameIntervalRef.current = setInterval(() => {
          captureAndSendFrame();
        }, 500); // 2 FPS
      }
    });

    newSocket.on('stream-joined', (data: { token: string }) => {
      console.log('✅ [VIEWER] Joined stream room', {
        token: data.token,
        expectedToken: gameToken,
      });
      setIsStreaming(true);
    });

    newSocket.on('stream-stopped', (data: { token: string }) => {
      console.log('Stream stopped by streamer');
      if (viewer) {
        // В режиме просмотра очищаем поток
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          setHasVideoStream(false);
        }
        setIsStreaming(false);
      }
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
    if (viewer) {
      // В режиме просмотра просто подключаемся к WebSocket
      connectWebSocket();
    } else {
      // В режиме стримера запускаем камеру и подключаемся
      await startCamera();
      connectWebSocket();
    }
  }, [startCamera, connectWebSocket, viewer]);

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

  // Автоматическое подключение в режиме просмотра
  useEffect(() => {
    if (viewer && !socket && !isStreaming) {
      // Автоматически подключаемся к стриму при монтировании в режиме просмотра
      connectWebSocket();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]); // Выполняется только при изменении viewer

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
                <p className="mb-4">{viewer ? 'Ожидание видеопотока...' : 'Видео не запущено'}</p>
                {!isStreaming && !viewer && <Button onClick={startStreaming}>Начать стрим</Button>}
              </div>
            </div>
          )}
          {hasVideoStream && videoRef.current?.srcObject && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-10">
              {viewer ? 'Просмотр активен' : 'Камера активна'}
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
