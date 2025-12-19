'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '@/lib/hooks/useEngine';
import { Button } from '@/components/ui/button';
import { MovesList } from '@/components/shared';
import * as mediasoupClient from 'mediasoup-client';

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

  // Mediasoup refs
  const deviceRef = useRef<mediasoupClient.types.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const consumerRef = useRef<mediasoupClient.types.Consumer | null>(null);

  // Состояние калибровки и старта партии (актуально для стримера)
  const [calibrationInProgress, setCalibrationInProgress] = useState(false);
  const [calibrationCompleted, setCalibrationCompleted] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [mappingData, setMappingData] = useState<any>(null);

  // Режим выбора a1 (фолбек ориентации)
  const [a1SelectionMode, setA1SelectionMode] = useState(false);
  const [a1Setting, setA1Setting] = useState(false);
  const a1SettingRef = useRef(false);

  // Режим ручной калибровки (полигон)
  const [manualCalibrationMode, setManualCalibrationMode] = useState(false);
  const [calibrationCorners, setCalibrationCorners] = useState<{ x: number; y: number }[]>([]);
  const [manualCalibrationSending, setManualCalibrationSending] = useState(false);
  const calibrationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    a1SettingRef.current = a1Setting;
  }, [a1Setting]);

  // Функция для преобразования координат клика через perspective_matrix
  const transformPointToWarped = useCallback(
    (x: number, y: number, matrix: number[][]): [number, number] | null => {
      if (!matrix || matrix.length !== 3 || matrix[0].length !== 3) {
        return null;
      }

      // Преобразуем точку через матрицу перспективы
      // [x', y', w'] = M * [x, y, 1]
      const m = matrix;
      const w = m[2][0] * x + m[2][1] * y + m[2][2];

      if (Math.abs(w) < 1e-6) {
        return null; // Точка на бесконечности
      }

      const x_warped = (m[0][0] * x + m[0][1] * y + m[0][2]) / w;
      const y_warped = (m[1][0] * x + m[1][1] * y + m[1][2]) / w;

      return [x_warped, y_warped];
    },
    [],
  );

  // Обработчик клика по видео для выбора a1 или ручной калибровки
  const handleVideoClick = useCallback(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      // Обработка ручной калибровки (приоритет)
      if (manualCalibrationMode && calibrationCorners.length < 4) {
        const video = e.currentTarget;
        const rect = video.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (!videoWidth || !videoHeight) {
          console.error('Video dimensions not available');
          return;
        }

        // Вычисляем реальные координаты в исходном изображении
        const videoAspect = videoWidth / videoHeight;
        const containerAspect = rect.width / rect.height;

        let imgX: number, imgY: number;
        if (videoAspect > containerAspect) {
          const displayedWidth = rect.width;
          const displayedHeight = rect.width / videoAspect;
          const offsetY = (rect.height - displayedHeight) / 2;

          if (clickY < offsetY || clickY > offsetY + displayedHeight) {
            return;
          }

          const scale = videoWidth / displayedWidth;
          imgX = clickX * scale;
          imgY = (clickY - offsetY) * scale;
        } else {
          const displayedWidth = rect.height * videoAspect;
          const displayedHeight = rect.height;
          const offsetX = (rect.width - displayedWidth) / 2;

          if (clickX < offsetX || clickX > offsetX + displayedWidth) {
            return;
          }

          const scale = videoHeight / displayedHeight;
          imgX = (clickX - offsetX) * scale;
          imgY = clickY * scale;
        }

        // Добавляем точку
        const newCorners = [...calibrationCorners, { x: imgX, y: imgY }];
        setCalibrationCorners(newCorners);

        // Если набрали 4 точки, можно отправить
        if (newCorners.length === 4) {
          console.log('4 corners collected:', newCorners);
        }

        return;
      }

      // Обработка выбора a1 (оригинальный код)
      if (!a1SelectionMode || !mappingData || !socket || a1Setting) {
        return;
      }

      const video = e.currentTarget;
      const rect = video.getBoundingClientRect();

      // Координаты клика относительно видео элемента
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Получаем реальные размеры видео
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (!videoWidth || !videoHeight) {
        console.error('Video dimensions not available');
        return;
      }

      // Вычисляем реальные координаты в исходном изображении
      // (учитываем object-fit: contain)
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = rect.width / rect.height;

      let imgX: number, imgY: number;
      if (videoAspect > containerAspect) {
        // Видео шире контейнера - есть черные полосы сверху/снизу
        const displayedWidth = rect.width;
        const displayedHeight = rect.width / videoAspect;
        const offsetY = (rect.height - displayedHeight) / 2;

        // Проверяем, что клик внутри отображаемой области
        if (clickY < offsetY || clickY > offsetY + displayedHeight) {
          return; // Клик вне видео
        }

        const scale = videoWidth / displayedWidth;
        imgX = clickX * scale;
        imgY = (clickY - offsetY) * scale;
      } else {
        // Видео выше контейнера - есть черные полосы слева/справа
        const displayedWidth = rect.height * videoAspect;
        const displayedHeight = rect.height;
        const offsetX = (rect.width - displayedWidth) / 2;

        // Проверяем, что клик внутри отображаемой области
        if (clickX < offsetX || clickX > offsetX + displayedWidth) {
          return; // Клик вне видео
        }

        const scale = videoHeight / displayedHeight;
        imgX = (clickX - offsetX) * scale;
        imgY = clickY * scale;
      }

      // Преобразуем через perspective_matrix в warped-координаты
      if (mappingData.perspective_matrix) {
        const warpedCoords = transformPointToWarped(imgX, imgY, mappingData.perspective_matrix);

        if (warpedCoords) {
          setA1Setting(true);
          socket.emit('set-a1', {
            token: gameToken,
            x: warpedCoords[0],
            y: warpedCoords[1],
          });
        } else {
          console.error('Failed to transform coordinates');
        }
      } else {
        console.error('Perspective matrix not available');
      }
    },
    [
      a1SelectionMode,
      mappingData,
      socket,
      gameToken,
      transformPointToWarped,
      a1Setting,
      manualCalibrationMode,
      calibrationCorners,
    ],
  );

  // Функция для отправки ручной калибровки
  const sendManualCalibration = useCallback(async () => {
    if (
      calibrationCorners.length !== 4 ||
      !socket ||
      !videoRef.current ||
      manualCalibrationSending
    ) {
      return;
    }

    setManualCalibrationSending(true);

    try {
      // Получаем текущий кадр с видео
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!canvas) {
        throw new Error('Canvas not available');
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Video not ready');
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      // УБРАЛИ ПОВОРОТЫ - отправляем как есть с камеры
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Конвертируем в JPEG
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          0.9,
        );
      });

      const buffer = await blob.arrayBuffer();
      const frameData = new Uint8Array(buffer);

      // Отправляем на бэкенд
      const currentSocket = socketRef.current || socket;
      if (!currentSocket) {
        throw new Error('Socket not available');
      }

      currentSocket.emit('manual-calibrate', {
        token: gameToken,
        frame: frameData,
        corners: calibrationCorners,
      });

      console.log('Manual calibration sent:', {
        token: gameToken,
        corners: calibrationCorners,
        frameSize: frameData.length,
      });
      setManualCalibrationSending(false);
    } catch (error) {
      console.error('Error sending manual calibration:', error);
      setError(`Ошибка отправки калибровки: ${(error as Error).message}`);
      setManualCalibrationSending(false);
    }
  }, [calibrationCorners, socket, gameToken, manualCalibrationSending, socketRef]);

  // Функция для отрисовки полигона на canvas overlay
  const drawCalibrationPolygon = useCallback(() => {
    if (!calibrationCanvasRef.current || !videoRef.current || calibrationCorners.length === 0) {
      return;
    }

    const canvas = calibrationCanvasRef.current;
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Вычисляем масштаб для отображения координат
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      return;
    }

    const videoAspect = videoWidth / videoHeight;
    const containerAspect = rect.width / rect.height;

    let scaleX: number, scaleY: number, offsetX: number, offsetY: number;

    if (videoAspect > containerAspect) {
      const displayedWidth = rect.width;
      const displayedHeight = rect.width / videoAspect;
      offsetY = (rect.height - displayedHeight) / 2;
      offsetX = 0;
      scaleX = displayedWidth / videoWidth;
      scaleY = displayedHeight / videoHeight;
    } else {
      const displayedWidth = rect.height * videoAspect;
      const displayedHeight = rect.height;
      offsetX = (rect.width - displayedWidth) / 2;
      offsetY = 0;
      scaleX = displayedWidth / videoWidth;
      scaleY = displayedHeight / videoHeight;
    }

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем точки и линии
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = '#3b82f6';
    ctx.lineWidth = 2;

    if (calibrationCorners.length > 0) {
      // Рисуем точки
      calibrationCorners.forEach((corner, index) => {
        const x = offsetX + corner.x * scaleX;
        const y = offsetY + corner.y * scaleY;

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Номер точки
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1), x, y);
        ctx.fillStyle = '#3b82f6';
      });

      // Рисуем линии между точками
      if (calibrationCorners.length > 1) {
        ctx.beginPath();
        const first = calibrationCorners[0];
        const firstX = offsetX + first.x * scaleX;
        const firstY = offsetY + first.y * scaleY;
        ctx.moveTo(firstX, firstY);

        for (let i = 1; i < calibrationCorners.length; i++) {
          const corner = calibrationCorners[i];
          const x = offsetX + corner.x * scaleX;
          const y = offsetY + corner.y * scaleY;
          ctx.lineTo(x, y);
        }

        // Если 4 точки, замыкаем полигон
        if (calibrationCorners.length === 4) {
          ctx.closePath();
        }

        ctx.stroke();
      }
    }
  }, [calibrationCorners]);

  // Обновляем отрисовку полигона при изменении точек или видео
  useEffect(() => {
    if (manualCalibrationMode) {
      drawCalibrationPolygon();
      const interval = setInterval(drawCalibrationPolygon, 100);
      return () => clearInterval(interval);
    }
  }, [manualCalibrationMode, calibrationCorners, drawCalibrationPolygon]);

  const {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
    setPositionFromFen,
  } = useEngine();

  // История ходов (ориентированная доска)
  const [moves, setMoves] = useState<{ san: string; uci: string }[]>([]);

  // Функция для конвертации board_state (8x8 массив с ID фигур) в FEN
  const boardStateToFen = useCallback((boardState: number[][]): string => {
    // Маппинг ID фигур в FEN символы
    const pieceMap: { [key: number]: string } = {
      0: 'P', // white-pawn
      1: 'R', // white-rook
      2: 'B', // white-bishop
      3: 'N', // white-knight
      4: 'K', // white-king
      5: 'Q', // white-queen
      6: 'p', // black-pawn
      7: 'r', // black-rook
      8: 'b', // black-bishop
      9: 'k', // black-king
      10: 'q', // black-queen
      11: 'n', // black-knight
    };

    let fen = '';

    // Проходим по строкам доски (сверху вниз для FEN)
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;

      for (let col = 0; col < 8; col++) {
        const pieceId = boardState[row][col];

        if (pieceId === -1) {
          // Пустая клетка
          emptyCount++;
        } else {
          // Если были пустые клетки, добавляем их количество
          if (emptyCount > 0) {
            fen += emptyCount.toString();
            emptyCount = 0;
          }
          // Добавляем символ фигуры
          fen += pieceMap[pieceId] || '';
        }
      }

      // Если в конце строки были пустые клетки
      if (emptyCount > 0) {
        fen += emptyCount.toString();
      }

      // Разделитель между строками (кроме последней)
      if (row < 7) {
        fen += '/';
      }
    }

    // Проверяем, есть ли короли на доске (обязательно для валидной FEN в chess.js)
    const hasWhiteKing = boardState.some((row) => row.some((cell) => cell === 4));
    const hasBlackKing = boardState.some((row) => row.some((cell) => cell === 9));

    // Если нет хотя бы одного короля, используем минимальную валидную позицию
    // Это нужно для тестирования пустой доски
    if (!hasWhiteKing || !hasBlackKing) {
      // Если доска полностью пустая или нет королей, используем минимальную валидную позицию
      const isEmpty = boardState.every((row) => row.every((cell) => cell === -1));
      if (isEmpty || (!hasWhiteKing && !hasBlackKing)) {
        return '8/8/8/8/8/8/8/4K2k w - - 0 1';
      }
    }

    // Добавляем остальные части FEN (ход, рокировки, en passant, счетчик ходов)
    // Для тестирования используем стандартные значения
    fen += ' w - - 0 1';

    return fen;
  }, []);

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

    // УБРАЛИ ВСЕ ПОВОРОТЫ - отправляем как есть с камеры
    // Координаты модели будут адаптированы на бэкенде если нужно
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    console.log(`📤 [STREAMER] Sending canvas AS-IS from camera: ${canvas.width}x${canvas.height}`);

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

  // Инициализация mediasoup device
  const initMediasoupDevice = useCallback(
    async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
      try {
        if (!deviceRef.current) {
          deviceRef.current = new mediasoupClient.Device();
          await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
          console.log('✅ Mediasoup device initialized');
        }
        return deviceRef.current;
      } catch (error) {
        console.error('❌ Error initializing mediasoup device:', error);
        throw error;
      }
    },
    [],
  );

  // Создание producer для стримера
  const createProducer = useCallback(
    async (stream: MediaStream) => {
      console.log('📹 [STREAMER] createProducer called', {
        hasSocket: !!socketRef.current,
        hasDevice: !!deviceRef.current,
        hasStream: !!stream,
        streamActive: stream?.active,
        videoTracks: stream?.getVideoTracks().length,
      });

      if (!socketRef.current || !deviceRef.current) {
        throw new Error('Socket or device not initialized');
      }

      try {
        console.log('📹 [STREAMER] Requesting transport creation...');
        // Создаем transport для отправки
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

        sendTransport.on(
          'produce',
          async (
            {
              kind,
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
        console.log('📹 [STREAMER] Send transport created:', sendTransport.id);

        // Создаем producer из видеопотока
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error('No video track in stream');
        }

        // Получаем настройки трека для логирования ориентации
        const trackSettings = videoTrack.getSettings();
        console.log('📹 [STREAMER] Producing video track...', {
          trackId: videoTrack.id,
          trackEnabled: videoTrack.enabled,
          trackReadyState: videoTrack.readyState,
          width: trackSettings.width,
          height: trackSettings.height,
          aspectRatio: trackSettings.aspectRatio,
          orientation:
            trackSettings.width && trackSettings.height
              ? trackSettings.width > trackSettings.height
                ? 'landscape'
                : 'portrait'
              : 'unknown',
        });

        const producer = await sendTransport.produce({ track: videoTrack });
        producerRef.current = producer;

        console.log('✅ [STREAMER] Producer created successfully:', {
          producerId: producer.id,
          kind: producer.kind,
          paused: producer.paused,
          videoOrientation:
            trackSettings.width && trackSettings.height
              ? `${trackSettings.width}x${trackSettings.height} (${
                  trackSettings.width > trackSettings.height ? 'landscape' : 'portrait'
                })`
              : 'unknown',
        });
        return producer;
      } catch (error) {
        console.error('❌ Error creating producer:', error);
        throw error;
      }
    },
    [gameToken, initMediasoupDevice],
  );

  // Флаг, чтобы не создавать нескольких consumer одновременно
  const consumerCreatingRef = useRef(false);
  // Ref для throttling логирования детекций без фигур (логируем раз в 5 секунд)
  const lastDetectionLogRef = useRef<number>(0);
  // Ref для throttling логирования обновлений board_state (логируем раз в 2 секунды)
  const lastBoardStateLogRef = useRef<number>(0);

  // Создание consumer для зрителей
  const createConsumer = useCallback(
    async (producerId: string) => {
      console.log('👀 [VIEWER] createConsumer called', {
        producerId,
        hasSocket: !!socketRef.current,
        hasDevice: !!deviceRef.current,
        hasVideo: !!videoRef.current,
      });

      if (!socketRef.current || !deviceRef.current || !videoRef.current) {
        throw new Error('Socket, device or video element not initialized');
      }

      // Если уже идёт создание consumer — не запускаем второе параллельно
      if (consumerCreatingRef.current) {
        console.warn('👀 [VIEWER] Consumer creation already in progress, skipping');
        return;
      }

      consumerCreatingRef.current = true;

      try {
        console.log('👀 [VIEWER] Requesting receive transport...');
        // Создаем transport для приема
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

        // Создаем consumer
        socketRef.current.emit('consume', {
          token: gameToken,
          transportId: recvTransport.id,
          producerId,
          // Передаём RTP‑возможности клиента, чтобы сервер создавал совместимый consumer
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

        console.log('👀 [VIEWER] Consuming track...', {
          consumerId: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
        });

        const consumer = await recvTransport.consume({
          id: consumerData.id,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        consumerRef.current = consumer;

        console.log('👀 [VIEWER] Consumer track obtained:', {
          consumerId: consumer.id,
          trackId: consumer.track.id,
          trackKind: consumer.track.kind,
          trackEnabled: consumer.track.enabled,
          trackReadyState: consumer.track.readyState,
          trackMuted: consumer.track.muted,
        });

        // Присваиваем track к video элементу
        const stream = new MediaStream([consumer.track]);
        console.log('👀 [VIEWER] Created MediaStream from track:', {
          streamId: stream.id,
          tracks: stream.getTracks().map((t) => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            readyState: t.readyState,
          })),
        });

        if (videoRef.current) {
          console.log('👀 [VIEWER] Assigning stream to video element...');
          videoRef.current.srcObject = stream;
          setHasVideoStream(true);

          // Принудительно запускаем воспроизведение
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true;

          // Добавляем обработчики событий track для отладки
          consumer.track.onended = () => {
            console.warn('⚠️ [VIEWER] Consumer track ended');
          };
          consumer.track.onmute = () => {
            console.warn('⚠️ [VIEWER] Consumer track muted');
          };
          consumer.track.onunmute = () => {
            console.log('✅ [VIEWER] Consumer track unmuted');
          };

          // Проверяем состояние track сразу после присвоения
          console.log('👀 [VIEWER] Track state immediately after assignment:', {
            trackId: consumer.track.id,
            enabled: consumer.track.enabled,
            readyState: consumer.track.readyState,
            muted: consumer.track.muted,
          });

          // Проверяем состояние через 1 секунду
          setTimeout(() => {
            console.log('👀 [VIEWER] Track state after 1 second:', {
              trackId: consumer.track.id,
              enabled: consumer.track.enabled,
              trackReadyState: consumer.track.readyState,
              muted: consumer.track.muted,
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
              videoReadyState: videoRef.current?.readyState,
            });
          }, 1000);

          // Проверяем состояние через 3 секунды
          setTimeout(() => {
            console.log('👀 [VIEWER] Track state after 3 seconds:', {
              trackId: consumer.track.id,
              enabled: consumer.track.enabled,
              trackReadyState: consumer.track.readyState,
              muted: consumer.track.muted,
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
              videoReadyState: videoRef.current?.readyState,
            });
          }, 3000);

          try {
            console.log('👀 [VIEWER] Attempting to play video...');
            await videoRef.current.play();
            console.log('✅ [VIEWER] Video playback started successfully');

            // Проверяем состояние через небольшую задержку
            setTimeout(() => {
              if (videoRef.current) {
                console.log('👀 [VIEWER] Video state after play:', {
                  videoWidth: videoRef.current.videoWidth,
                  videoHeight: videoRef.current.videoHeight,
                  readyState: videoRef.current.readyState,
                  paused: videoRef.current.paused,
                  hasSrcObject: !!videoRef.current.srcObject,
                  trackEnabled: consumer.track.enabled,
                  trackReadyState: consumer.track.readyState,
                });
              }
            }, 500);
          } catch (error) {
            console.error('❌ [VIEWER] Error playing video:', error);
            // Пробуем еще раз через небольшую задержку
            setTimeout(() => {
              videoRef.current?.play().catch((e) => {
                console.error('❌ [VIEWER] Retry play failed:', e);
              });
            }, 100);
          }
        }

        console.log('✅ [VIEWER] Consumer created successfully:', {
          consumerId: consumer.id,
          producerId: consumer.producerId,
        });
        return consumer;
      } catch (error) {
        console.error('❌ Error creating consumer:', error);
        throw error;
      } finally {
        consumerCreatingRef.current = false;
      }
    },
    [gameToken, initMediasoupDevice],
  );

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
      // Пробуем запросить портретную ориентацию с разными подходами
      // Проблема: некоторые браузеры игнорируют exact constraints или конфликтуют width/height с aspectRatio
      let stream: MediaStream;
      try {
        // Подход 1: Запрашиваем 1600x1200 (альбомная) - камера может поменять местами и дать 1200x1600 (портретная)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1600, min: 1200, max: 1920 },
            height: { ideal: 1200, min: 800, max: 1600 },
            aspectRatio: { exact: 4 / 3 }, // Соотношение 4:3 (width/height = 1.33) - альбомная ориентация
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
              width: { ideal: 1600 },
              height: { ideal: 1200 },
              aspectRatio: 4 / 3, // Без exact
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
      const actualWidth = settings.width || 0;
      const actualHeight = settings.height || 0;
      const actualAspectRatio = settings.aspectRatio || 0;
      const isPortrait = actualHeight > actualWidth;

      console.log('📹 [CAMERA] Camera returned:', {
        width: actualWidth,
        height: actualHeight,
        aspectRatio: actualAspectRatio,
      });

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
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          console.log('✅ Video metadata loaded:', {
            videoWidth,
            videoHeight,
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

    // Регистрируем обработчик video-frame ДО подключения (fallback для старых клиентов)
    // Этот обработчик используется только если mediasoup не работает
    newSocket.on('video-frame', (data: { token: string; frame: string }) => {
      // Пропускаем если уже есть mediasoup consumer
      if (consumerRef.current) {
        return;
      }
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
            // Используем 30 FPS для плавного просмотра зрителями
            const stream = canvas.captureStream(30);
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

    newSocket.on('stream-started', async () => {
      console.log('📹 [STREAMER] Stream started event received');
      setIsStreaming(true);

      if (!viewer) {
        // Для анализа отправляем кадры с низкой частотой (2 FPS) через WebSocket
        frameIntervalRef.current = setInterval(() => {
          captureAndSendFrame();
        }, 500); // 2 FPS для анализа

        // Для зрителей создаем mediasoup producer из реального потока камеры
        // Проверяем наличие потока и создаем producer
        const tryCreateProducer = () => {
          if (streamRef.current && !producerRef.current) {
            console.log('📹 [STREAMER] Stream ready, requesting RTP capabilities...', {
              hasStream: !!streamRef.current,
              hasProducer: !!producerRef.current,
              streamActive: streamRef.current?.active,
            });
            try {
              // Получаем RTP capabilities
              newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
            } catch (error) {
              console.error('❌ [STREAMER] Error requesting RTP capabilities:', error);
            }
          } else {
            console.warn('⚠️ [STREAMER] Stream not ready yet, retrying...', {
              hasStream: !!streamRef.current,
              hasProducer: !!producerRef.current,
            });
            // Повторяем попытку через 100мс, если поток еще не готов
            setTimeout(tryCreateProducer, 100);
          }
        };

        // Пытаемся создать producer сразу или через небольшую задержку
        if (streamRef.current) {
          tryCreateProducer();
        } else {
          console.log('📹 [STREAMER] Waiting for stream to be ready...');
          setTimeout(tryCreateProducer, 200);
        }
      }
    });

    // Обработчик RTP capabilities для инициализации device
    newSocket.on(
      'router-rtp-capabilities',
      async (rtpCapabilities: mediasoupClient.types.RtpCapabilities) => {
        try {
          console.log('📹 [STREAMER] Received RTP capabilities, initializing device...');
          await initMediasoupDevice(rtpCapabilities);

          if (!viewer && streamRef.current && !producerRef.current) {
            // Стример: создаем producer
            console.log('📹 [STREAMER] Creating producer from stream...', {
              hasStream: !!streamRef.current,
              streamActive: streamRef.current?.active,
              videoTracks: streamRef.current?.getVideoTracks().length,
            });
            await createProducer(streamRef.current);
            console.log('✅ [STREAMER] Mediasoup producer created successfully');
          } else if (viewer) {
            // Зритель: после инициализации device запрашиваем список producer'ов
            console.log('👀 [VIEWER] Device initialized, requesting producers...');
            newSocket.emit('get-producers', { token: gameToken });
          } else {
            console.warn('⚠️ [STREAMER] Cannot create producer:', {
              isViewer: viewer,
              hasStream: !!streamRef.current,
              hasProducer: !!producerRef.current,
            });
          }
        } catch (error) {
          console.error('❌ Error handling RTP capabilities:', error);
          setError(`Ошибка инициализации медиапотока: ${(error as Error).message}`);
        }
      },
    );

    // Обработчик списка producer'ов для зрителей
    newSocket.on('producers', async (producers: Array<{ id: string; kind: string }>) => {
      console.log('👀 [VIEWER] Received producers list:', {
        count: producers.length,
        producers: producers.map((p) => ({ id: p.id, kind: p.kind })),
        hasConsumer: !!consumerRef.current,
        hasDevice: !!deviceRef.current,
      });

      if (viewer && producers.length > 0 && !consumerRef.current) {
        try {
          // Берем первый video producer
          const videoProducer = producers.find((p) => p.kind === 'video');
          if (videoProducer && deviceRef.current) {
            // Device уже инициализирован, создаем consumer
            console.log('👀 [VIEWER] Creating consumer for producer:', videoProducer.id);
            await createConsumer(videoProducer.id);
          } else if (videoProducer && !deviceRef.current) {
            // Device еще не инициализирован, запрашиваем capabilities
            // Consumer будет создан после инициализации device в обработчике router-rtp-capabilities
            console.log('👀 [VIEWER] Waiting for device initialization before creating consumer');
          } else {
            console.warn('👀 [VIEWER] No video producer found or device not ready:', {
              hasVideoProducer: !!videoProducer,
              hasDevice: !!deviceRef.current,
            });
          }
        } catch (error) {
          console.error('❌ [VIEWER] Error creating consumer:', error);
          setError(`Ошибка подключения к потоку: ${(error as Error).message}`);
        }
      } else {
        console.log('👀 [VIEWER] Skipping consumer creation:', {
          isViewer: viewer,
          hasProducers: producers.length > 0,
          hasConsumer: !!consumerRef.current,
        });
      }
    });

    // Обработчик нового producer для зрителей
    newSocket.on('producer-created', async (data: { producerId: string; token: string }) => {
      console.log('👀 [VIEWER] Producer created event received:', {
        producerId: data.producerId,
        token: data.token,
        expectedToken: gameToken,
        hasDevice: !!deviceRef.current,
        hasConsumer: !!consumerRef.current,
      });

      if (viewer && data.token === gameToken && !consumerRef.current) {
        try {
          if (!deviceRef.current) {
            // Если device еще не инициализирован, запрашиваем capabilities
            // Consumer будет создан после инициализации device
            console.log('👀 [VIEWER] Requesting RTP capabilities for new producer...');
            newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
          } else {
            // Device уже инициализирован, создаем consumer сразу
            console.log('👀 [VIEWER] Creating consumer for new producer:', data.producerId);
            await createConsumer(data.producerId);
          }
        } catch (error) {
          console.error('Error creating consumer for new producer:', error);
          setError(`Ошибка подключения к потоку: ${(error as Error).message}`);
        }
      }
    });

    newSocket.on('stream-joined', async (data: { token: string }) => {
      console.log('✅ [VIEWER] Joined stream room', {
        token: data.token,
        expectedToken: gameToken,
      });
      setIsStreaming(true);

      // Для зрителей запрашиваем RTP capabilities и список producer'ов
      if (viewer) {
        try {
          console.log('👀 [VIEWER] Requesting RTP capabilities and producers...');
          newSocket.emit('get-router-rtp-capabilities', { token: gameToken });
          newSocket.emit('get-producers', { token: gameToken });
        } catch (error) {
          console.error('❌ [VIEWER] Error requesting mediasoup info:', error);
        }
      }
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
      setCalibrationInProgress(true);
      setCalibrationCompleted(false);
      setCalibrationMessage(data.message || 'Калибровка доски...');
    });

    newSocket.on('calibration-completed', (data: { message: string; mappingData?: any }) => {
      console.log('Calibration completed:', data.message);
      setError(null);
      setCalibrationInProgress(false);
      setCalibrationCompleted(true);
      setCalibrationMessage(data.message || 'Калибровка выполнена');
      if (data.mappingData) {
        setMappingData(data.mappingData);
        // Если ориентация не установлена автоматически, предлагаем ручную
        if (!data.mappingData.orientation_set_manually && !data.mappingData.index_map) {
          // Можно показать подсказку, но не включать режим автоматически
        }
      }
      // Сбрасываем состояние ручной калибровки
      setManualCalibrationMode(false);
      setCalibrationCorners([]);
      setManualCalibrationSending(false);
    });

    newSocket.on('a1-set', (data: { message: string }) => {
      console.log('A1 orientation set:', data.message);
      setA1Setting(false);
      setA1SelectionMode(false);
      setCalibrationMessage('Ориентация установлена. Можно начинать партию.');
      // Обновляем mappingData, чтобы отразить, что ориентация установлена
      if (mappingData) {
        setMappingData({ ...mappingData, orientation_set_manually: true });
      }
    });

    newSocket.on('frame-processed', (data: any) => {
      // Логируем информацию о детекциях
      if (data.detections_info) {
        const detInfo = data.detections_info;
        if (detInfo.total_detections > 0) {
          const classesStr = Object.entries(detInfo.classes_detected || {})
            .map(([cls, count]) => `${cls}: ${count}`)
            .join(', ');
          console.log(`🔍 [DETECTION] Found ${detInfo.total_detections} pieces: ${classesStr}`);
        } else {
          // Логируем только периодически (раз в 5 секунд), чтобы не спамить консоль
          const now = Date.now();
          if (now - lastDetectionLogRef.current > 5000) {
            lastDetectionLogRef.current = now;
            console.debug(
              `🔍 [DETECTION] No pieces detected${detInfo.message ? ` - ${detInfo.message}` : ''}`,
            );
          }
        }
      }

      // ВСЕГДА обновляем доску по board_state (даже если фигуры "скачут")
      // board_state содержит актуальное состояние доски на каждый кадр
      if (data.board_state && Array.isArray(data.board_state)) {
        try {
          const fen = boardStateToFen(data.board_state);
          setPositionFromFen(fen);
          // Логируем обновление доски (периодически, чтобы не спамить)
          const now = Date.now();
          if (now - lastBoardStateLogRef.current > 2000) {
            // Считаем заполненные клетки
            const filled = data.board_state.flat().filter((id: number) => id !== -1).length;
            console.log(`🔄 [BOARD] Updated board state from backend: ${filled}/64 squares filled`);
            lastBoardStateLogRef.current = now;
          }
        } catch (error) {
          console.warn('⚠️ Failed to convert board_state to FEN:', error);
        }
      }

      // Если есть move, добавляем его в историю (но НЕ применяем через applyExternalMove,
      // так как board_state уже содержит актуальную позицию после хода)
      if (data.move) {
        console.log('♟️ Move detected:', data.move, data.move_san);
        // Для стримера добавляем ходы в историю только после нажатия "Начать партию"
        if (!viewer && !gameStarted) {
          // Для стримера: не добавляем в историю до старта партии
          return;
        }
        // Добавляем ход в историю (board_state уже обновлен выше)
        setMoves((prev) => {
          // Проверяем, нет ли уже такого хода (защита от дубликатов)
          const lastMove = prev[prev.length - 1];
          if (lastMove && lastMove.uci === data.move) {
            return prev; // Ход уже в истории
          }
          return [
            ...prev,
            {
              san: data.move_san || data.move,
              uci: data.move,
            },
          ];
        });
      } else if (data.status === 'error' || data.message?.includes('error')) {
        // Логируем только ошибки, не каждое сообщение "Mapping not found"
        console.warn('⚠️ Frame processing error:', data.message || data.status);
      }
      // Иначе не логируем каждый кадр без хода
    });

    newSocket.on('error', (error: { message: string }) => {
      setError(error.message);
      console.error('WebSocket error:', error);
      // Сбрасываем состояние a1, если была ошибка при установке
      if (a1SettingRef.current) {
        setA1Setting(false);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsStreaming(false);
      setCalibrationInProgress(false);
      setCalibrationCompleted(false);
      setCalibrationMessage(null);
      setGameStarted(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    });

    setSocket(newSocket);
    socketRef.current = newSocket; // Сохраняем в ref для cleanup
  }, [
    gameToken,
    modelPath,
    captureAndSendFrame,
    initMediasoupDevice,
    createProducer,
    createConsumer,
  ]);

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

    // Закрываем mediasoup соединения
    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }
    if (consumerRef.current) {
      consumerRef.current.close();
      consumerRef.current = null;
    }
    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
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
    setCalibrationInProgress(false);
    setCalibrationCompleted(false);
    setCalibrationMessage(null);
    setGameStarted(false);
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

  // Старт партии (после калибровки)
  const handleStartGame = useCallback(() => {
    if (!calibrationCompleted) return;
    // Сбрасываем историю ходов и помечаем, что партия началась
    setMoves([]);
    setGameStarted(true);
  }, [calibrationCompleted]);

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
            orientation: video.videoHeight > video.videoWidth ? 'PORTRAIT' : 'LANDSCAPE',
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
              cursor: a1SelectionMode || manualCalibrationMode ? 'crosshair' : 'default',
              // УБРАЛИ CSS ПОВОРОТ - показываем как есть с камеры
            }}
            onClick={handleVideoClick}
            onLoadedMetadata={() => {
              console.log('✅ JSX onLoadedMetadata fired');
              if (videoRef.current) {
                videoRef.current.play().catch((err) => {
                  console.error('Error playing in onLoadedMetadata:', err);
                });
              }
              setHasVideoStream(true);
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
          {/* Canvas overlay для отрисовки полигона калибровки */}
          {manualCalibrationMode && (
            <canvas
              ref={calibrationCanvasRef}
              className="absolute inset-0 pointer-events-none z-10"
              style={{ width: '100%', height: '100%' }}
            />
          )}
          {isStreaming && hasVideoStream && (
            <div className="absolute top-2 right-2">
              <div className="bg-red-500 text-white px-2 py-1 rounded text-sm">LIVE</div>
            </div>
          )}
          {a1SelectionMode && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md text-center">
                <h3 className="text-lg font-semibold mb-2">Укажите клетку a1</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Кликните на клетку a1 (нижний левый угол доски, где стоит белая ладья)
                </p>
                {a1Setting && <p className="text-sm text-blue-500 mb-2">Обработка...</p>}
                <Button
                  onClick={() => {
                    setA1SelectionMode(false);
                    setA1Setting(false);
                  }}
                  variant="outline"
                  disabled={a1Setting}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
        {cameraError && <p className="text-red-500 text-sm mt-2">{cameraError}</p>}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {!viewer && isStreaming && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleStartGame}
                disabled={!calibrationCompleted || gameStarted}
                variant={gameStarted ? 'outline' : 'default'}>
                {gameStarted ? 'Партия идёт' : 'Начать партию'}
              </Button>
              <Button onClick={stopStreaming} variant="destructive">
                Остановить стрим
              </Button>
            </div>
            {/* Кнопка "Проблемы с калибровкой?" - всегда видна */}
            <Button
              onClick={() => {
                setManualCalibrationMode(true);
                setCalibrationCorners([]);
              }}
              variant="outline"
              disabled={manualCalibrationMode || manualCalibrationSending}
              className="text-sm">
              Проблемы с калибровкой? Нажмите сюда
            </Button>
            {/* Информация и управление ручной калибровкой */}
            {manualCalibrationMode && (
              <div className="flex flex-col gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm font-semibold">
                  Режим ручной калибровки: Кликните по 4 углам доски по часовой стрелке
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Установлено точек: {calibrationCorners.length}/4
                </p>
                {manualCalibrationSending && (
                  <p className="text-sm text-blue-500">Отправка калибровки...</p>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={sendManualCalibration}
                    disabled={calibrationCorners.length !== 4 || manualCalibrationSending}
                    variant="default"
                    size="sm">
                    Подтвердить калибровку
                  </Button>
                  <Button
                    onClick={() => {
                      setManualCalibrationMode(false);
                      setCalibrationCorners([]);
                      setManualCalibrationSending(false);
                    }}
                    variant="outline"
                    disabled={manualCalibrationSending}
                    size="sm">
                    Отмена
                  </Button>
                  {calibrationCorners.length > 0 && (
                    <Button
                      onClick={() => setCalibrationCorners([])}
                      variant="outline"
                      disabled={manualCalibrationSending}
                      size="sm">
                      Сбросить точки
                    </Button>
                  )}
                </div>
              </div>
            )}
            {calibrationCompleted &&
              !mappingData?.orientation_set_manually &&
              !mappingData?.index_map && (
                <Button
                  onClick={() => setA1SelectionMode(true)}
                  variant="outline"
                  disabled={a1SelectionMode || a1Setting}
                  className="text-sm">
                  Указать клетку a1 (если нужно)
                </Button>
              )}
            {!calibrationCompleted && (
              <p className="text-xs text-muted-foreground">
                Дождитесь завершения калибровки доски, чтобы начать партию.
              </p>
            )}
            {calibrationInProgress && calibrationMessage && (
              <p className="text-xs text-muted-foreground">{calibrationMessage}</p>
            )}
            {calibrationCompleted && calibrationMessage && (
              <p className="text-xs text-muted-foreground">{calibrationMessage}</p>
            )}
          </div>
        )}
        {viewer && isStreaming && (
          <Button onClick={stopStreaming} className="mt-2" variant="destructive">
            Остановить просмотр
          </Button>
        )}
      </div>

      {/* Виртуальная доска, анализ и история ходов */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <Chessboard options={chessboardOptions} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-semibold">Движок: </span>
              {engineReady ? 'готов' : 'загрузка...'}
            </div>
            <div>
              <span className="font-semibold">Оценка: </span>
              {possibleMate ? `#${possibleMate}` : positionEvaluation}
            </div>
            <div>
              <span className="font-semibold">Глубина: </span>
              {depth}
            </div>
            <div>
              <span className="font-semibold">Лучшая линия: </span>
              <i>{bestLine.slice(0, 40)}...</i>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1 text-sm">Ходы партии</div>
            <MovesList moves={moves} />
          </div>
        </div>
      </div>
    </div>
  );
};
