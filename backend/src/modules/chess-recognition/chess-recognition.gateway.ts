import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import {
  ChessRecognitionService,
  type FrameProcessedResult,
} from './chess-recognition.service';
import { MediasoupService } from './mediasoup.service';
import sharp from 'sharp';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ws/chess-stream',
  transports: ['websocket', 'polling'],
})
export class ChessRecognitionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChessRecognitionGateway.name);
  private readonly clientGameTokens: Map<string, string> = new Map();
  private readonly clientRooms: Map<string, string> = new Map(); // clientId -> roomId
  private readonly streamers: Map<string, string> = new Map(); // clientId -> token (клиенты, которые отправляют кадры)
  private readonly calibrationAttempted: Map<string, boolean> = new Map(); // token -> attempted (чтобы калибровка запускалась только один раз
  private readonly lastCalibrationFrames: Map<string, Buffer> = new Map(); // token -> последний кадр для калибровки (интервальная калибровка)
  private readonly processStartedAfterCalibration: Map<string, boolean> =
    new Map(); // token -> started (чтобы не запускать процесс дважды после калибровки)
  private readonly autoCalibrationTimers: Map<string, NodeJS.Timeout> =
    new Map(); // token -> таймер автоматической калибровки

  constructor(
    private readonly chessRecognitionService: ChessRecognitionService,
    private readonly mediasoupService: MediasoupService,
  ) {
    // Инициализация mediasoup worker
    this.mediasoupService.initializeWorker();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // Подключение к комнате для просмотра стрима
  @SubscribeMessage('join-stream')
  async handleJoinStream(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;

    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }

    // Присоединяем клиента к комнате по token
    const roomId = `stream:${token}`;
    client.join(roomId);
    this.clientGameTokens.set(client.id, token);

    // Получаем количество клиентов в комнате для логирования
    let clientsInRoom = 0;
    try {
      const adapter = this.server.sockets.adapter;
      if (adapter && adapter.rooms) {
        const room = adapter.rooms.get(roomId);
        clientsInRoom = room ? Array.from(room).length : 0;
      }
    } catch (error) {
      // Игнорируем ошибку
    }

    this.logger.log(
      `👀 [VIEWER] Client ${client.id} joined stream room for token ${token} (${clientsInRoom} clients in room)`,
    );

    // Проверяем, есть ли уже producer в комнате mediasoup
    try {
      const producers = await this.mediasoupService.getProducers(token);
      if (producers.length > 0) {
        this.logger.log(
          `👀 [VIEWER] Found ${producers.length} existing producers, sending to client ${client.id}`,
        );
        // Отправляем существующие producers сразу после присоединения к комнате
        client.emit('producers', producers);
      }
    } catch (error) {
      this.logger.warn(`Failed to get producers for viewer: ${error.message}`);
    }

    client.emit('stream-joined', { token });
  }

  handleDisconnect(client: Socket) {
    const gameToken = this.clientGameTokens.get(client.id);
    const roomId = this.clientRooms.get(client.id);
    const isStreamer = this.streamers.has(client.id);

    if (gameToken) {
      // Останавливаем обработку только если это был стример
      if (isStreamer) {
        this.chessRecognitionService.stopStreamProcessing(gameToken);
      }
      this.clientGameTokens.delete(client.id);
    }

    if (isStreamer) {
      this.streamers.delete(client.id);
      // Очищаем флаги калибровки и процесса при отключении стримера
      if (gameToken) {
        this.calibrationAttempted.delete(gameToken);
        this.processStartedAfterCalibration.delete(gameToken);
      }
      this.logger.log(
        `Streamer ${client.id} disconnected, stopping stream for token ${gameToken}`,
      );
      // НЕ закрываем комнату при отключении стримера - producer может быть нужен зрителям
      // Комната закроется только когда все клиенты отключатся
    } else {
      // Для зрителей просто удаляем из clientRooms, но не закрываем комнату
      if (roomId) {
        this.clientRooms.delete(client.id);
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('start-stream')
  async handleStartStream(
    @MessageBody() data: { token: string; modelPath?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, modelPath } = data;

    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }

    this.logger.log(
      `📹 [STREAMER] Client ${client.id} starting stream for token ${token}`,
    );

    // Удаляем существующий маппинг при старте стрима (для тестирования)
    // Это позволяет каждый раз запускать калибровку заново
    await this.chessRecognitionService.deleteMapping(token);

    // Не проверяем маппинг при старте - калибровка произойдет автоматически при первом кадре
    // Путь к модели по умолчанию (относительно корня проекта)
    // Если модель не найдена, Python скрипт будет использовать предобученную YOLO11n
    const cwd = process.cwd();
    const projectRoot =
      cwd.endsWith('backend') ||
      cwd.endsWith('backend\\') ||
      cwd.endsWith('backend/')
        ? join(cwd, '..')
        : cwd;
    const defaultModelPath =
      process.env.YOLO_MODEL_PATH ||
      join(
        projectRoot,
        'chess-recognition',
        'assets',
        'models',
        'chess_pieces_yolo11_n_best.pt',
      );

    // Если файл модели не существует, передаем путь все равно
    // Python скрипт сам обработает отсутствие файла и использует предобученную модель

    // НЕ запускаем обработку потока здесь - она запустится в handleProduce после создания Mediasoup producer
    // Это нужно, чтобы callback отправлял события всем в комнате, а не только стримеру

    this.clientGameTokens.set(client.id, token);

    // Помечаем клиента как стримера и добавляем в комнату
    this.streamers.set(client.id, token);
    const roomId = `stream:${token}`;
    client.join(roomId);

    // Получаем количество клиентов в комнате для логирования
    let clientsInRoom = 0;
    try {
      const adapter = this.server.sockets.adapter;
      if (adapter && adapter.rooms) {
        const room = adapter.rooms.get(roomId);
        clientsInRoom = room ? Array.from(room).length : 0;
      }
    } catch (error) {
      // Игнорируем ошибку
    }

    this.logger.log(
      `📹 [STREAMER] Client ${client.id} started streaming for token ${token} (${clientsInRoom} clients in room)`,
    );

    client.emit('stream-started', { token });
  }

  @SubscribeMessage('get-router-rtp-capabilities')
  async handleGetRouterRtpCapabilities(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;
    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }

    this.logger.log(
      `📹 [MEDIASOUP] Client ${client.id} requested RTP capabilities for token ${token}`,
    );

    try {
      const rtpCapabilities =
        await this.mediasoupService.getRouterRtpCapabilities(token);
      client.emit('router-rtp-capabilities', rtpCapabilities);
      this.logger.log(
        `✅ [MEDIASOUP] RTP capabilities sent to client ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [MEDIASOUP] Error getting RTP capabilities: ${error.message}`,
      );
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('create-transport')
  async handleCreateTransport(
    @MessageBody() data: { token: string; direction: 'send' | 'recv' },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, direction } = data;
    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }

    try {
      await this.mediasoupService.createRoom(token);
      const transport = await this.mediasoupService.createWebRtcTransport(
        token,
        client.id,
        direction,
      );
      this.clientRooms.set(client.id, token);
      client.emit('transport-created', transport);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('connect-transport')
  async handleConnectTransport(
    @MessageBody() data: { token: string; dtlsParameters: any },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, dtlsParameters } = data;
    if (!token || !dtlsParameters) {
      client.emit('error', {
        message: 'Token and dtlsParameters are required',
      });
      return;
    }

    try {
      await this.mediasoupService.connectTransport(
        token,
        client.id,
        dtlsParameters,
      );
      client.emit('transport-connected');
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('produce')
  async handleProduce(
    @MessageBody()
    data: { token: string; transportId: string; rtpParameters: any },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, transportId, rtpParameters } = data;
    if (!token || !transportId || !rtpParameters) {
      client.emit('error', {
        message: 'Token, transportId and rtpParameters are required',
      });
      return;
    }

    this.logger.log(
      `📹 [STREAMER] Creating producer for client ${client.id}, token ${token}`,
    );

    try {
      // Убеждаемся, что комната существует перед созданием producer
      await this.mediasoupService.createRoom(token);

      const producer = await this.mediasoupService.createProducer(
        token,
        client.id,
        transportId,
        rtpParameters,
      );

      this.logger.log(
        `✅ [STREAMER] Producer created: ${producer.id} for token ${token}`,
      );

      // Запускаем обработку потока для этого токена
      const cwd = process.cwd();
      const projectRoot =
        cwd.endsWith('backend') ||
        cwd.endsWith('backend\\') ||
        cwd.endsWith('backend/')
          ? join(cwd, '..')
          : cwd;
      const defaultModelPath =
        process.env.YOLO_MODEL_PATH ||
        join(projectRoot, 'chess-recognition', 'bestmerged_new.pt');

      // Запускаем обработку потока только если еще не запущена И маппинг уже есть
      // Если маппинга еще нет, процесс будет запущен после завершения калибровки в handleFrame
      if (
        !this.chessRecognitionService.hasActiveProcess(token) &&
        this.chessRecognitionService.hasMapping(token)
      ) {
        this.logger.log(
          `📹 [STREAMER] Starting stream processing for token ${token} in handleProduce`,
        );
        this.chessRecognitionService.startStreamProcessing(
          token,
          defaultModelPath,
          (result: FrameProcessedResult) => {
            // Логирование информации о детекциях
            if (result?.detections_info) {
              const detInfo = result.detections_info;
              if ((detInfo.total_detections ?? 0) > 0) {
                const classesStr = Object.entries(
                  detInfo.classes_detected || {},
                )
                  .map(([cls, count]) => `${cls}: ${count}`)
                  .join(', ');
                this.logger.log(
                  `🔍 [DETECTION] Token ${token}: Found ${detInfo.total_detections} pieces (${classesStr})`,
                );
              } else {
                // Логируем отсутствие детекций каждый кадр
                this.logger.log(
                  `🔍 [DETECTION] Token ${token}: No pieces detected${detInfo.message ? ` - ${detInfo.message}` : ''}`,
                );
              }
            }

            // Отправляем результат стримеру напрямую
            client.emit('frame-processed', result);

            // И всем зрителям в комнате (исключая стримера, чтобы избежать дублирования)
            const roomId = `stream:${token}`;
            // Проверяем количество клиентов в комнате
            const adapter = this.server.sockets.adapter;
            const room = adapter.rooms.get(roomId);
            const clientsInRoom = room ? Array.from(room).length : 0;
            if (clientsInRoom > 0) {
              // Отправляем всем в комнате кроме стримера (чтобы избежать дублирования)
              client.to(roomId).emit('frame-processed', result);
            }

            if (result?.move) {
              this.logger.log(
                `♟️ Move detected for token ${token}: ${result.move} (${result.move_san || 'SAN?'})`,
              );
            }
          },
          (error) => {
            client.emit('error', { message: error.message });
          },
        );
      } else {
        if (this.chessRecognitionService.hasActiveProcess(token)) {
          this.logger.log(
            `📹 [STREAMER] Stream processing already active for token ${token}, skipping duplicate start`,
          );
        } else {
          this.logger.log(
            `📹 [STREAMER] Waiting for calibration to complete before starting stream processing for token ${token}`,
          );
        }
      }

      this.clientGameTokens.set(client.id, token);
      this.streamers.set(client.id, token); // Помечаем как стримера

      // Уведомляем всех в комнате о новом producer
      const roomId = `stream:${token}`;

      // Получаем количество клиентов в комнате для логирования
      let clientsInRoom = 0;
      try {
        const adapter = this.server.sockets.adapter;
        if (adapter && adapter.rooms) {
          const room = adapter.rooms.get(roomId);
          clientsInRoom = room ? Array.from(room).length : 0;
        }
      } catch (error) {
        // Игнорируем ошибку
      }

      this.logger.log(
        `📹 [STREAMER] Notifying ${clientsInRoom} clients in room ${roomId} about new producer ${producer.id}`,
      );

      // Отправляем событие всем в комнате (включая зрителей)
      this.server.to(roomId).emit('producer-created', {
        producerId: producer.id,
        token,
      });

      client.emit('produced', producer);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('consume')
  async handleConsume(
    @MessageBody()
    data: {
      token: string;
      transportId: string;
      producerId: string;
      rtpCapabilities: any;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, transportId, producerId, rtpCapabilities } = data;
    if (!token || !transportId || !producerId || !rtpCapabilities) {
      client.emit('error', {
        message:
          'Token, transportId, producerId and rtpCapabilities are required',
      });
      return;
    }

    this.logger.log(
      `👀 [VIEWER] Client ${client.id} requesting consumer for producer ${producerId}, token ${token}`,
    );

    try {
      const consumer = await this.mediasoupService.createConsumer(
        token,
        client.id,
        transportId,
        producerId,
        rtpCapabilities,
      );

      this.logger.log(
        `✅ [VIEWER] Consumer created: ${consumer.id} for client ${client.id}`,
      );

      this.clientRooms.set(client.id, token);
      client.emit('consumed', consumer);
    } catch (error) {
      this.logger.error(
        `❌ [VIEWER] Error creating consumer: ${error.message}`,
      );
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('resume-consumer')
  async handleResumeConsumer(
    @MessageBody() data: { token: string; consumerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, consumerId } = data;
    if (!token || !consumerId) {
      client.emit('error', { message: 'Token and consumerId are required' });
      return;
    }

    this.logger.log(
      `👀 [VIEWER] Client ${client.id} requesting resume for consumer ${consumerId}, token ${token}`,
    );

    try {
      await this.mediasoupService.resumeConsumer(token, consumerId);
      this.logger.log(
        `✅ [VIEWER] Consumer ${consumerId} resumed for client ${client.id}`,
      );
      client.emit('consumer-resumed', { consumerId });
    } catch (error) {
      this.logger.error(
        `❌ [VIEWER] Error resuming consumer ${consumerId}: ${error.message}`,
      );
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('get-producers')
  async handleGetProducers(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;
    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }

    this.logger.log(
      `👀 [VIEWER] Client ${client.id} requested producers for token ${token}`,
    );

    try {
      // Убеждаемся, что комната существует (если нет - создаем, но producers будет пустым)
      try {
        await this.mediasoupService.getRouterRtpCapabilities(token);
        this.logger.log(`👀 [VIEWER] Room ${token} exists`);
      } catch (error) {
        this.logger.warn(
          `👀 [VIEWER] Room ${token} does not exist yet, creating it...`,
        );
        await this.mediasoupService.createRoom(token);
      }

      const producers = await this.mediasoupService.getProducers(token);
      this.logger.log(
        `✅ [VIEWER] Sending ${producers.length} producers to client ${client.id} for token ${token}`,
      );
      client.emit('producers', producers);
    } catch (error) {
      this.logger.error(
        `❌ [VIEWER] Error getting producers for token ${token}: ${error.message}`,
      );
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('frame')
  async handleFrame(
    @MessageBody()
    data: { token: string; frame: Buffer | Uint8Array | number[] },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, frame } = data;

    if (!token || !frame) {
      client.emit('error', { message: 'Token and frame are required' });
      return;
    }

    try {
      // Конвертируем в Buffer если нужно
      const frameBuffer = Buffer.isBuffer(frame)
        ? frame
        : Buffer.from(frame as Uint8Array | number[]);

      // Логируем размер кадра и изображения периодически (раз в 5 секунд или при изменении размера)
      const lastLogKey = `frame_log_${token}`;
      const lastLog = (this as any)[lastLogKey] || {
        time: 0,
        size: 0,
        imageSize: null,
      };
      const now = Date.now();

      if (now - lastLog.time > 5000 || lastLog.size !== frameBuffer.length) {
        // Декодируем изображение чтобы узнать реальные размеры
        try {
          const metadata = await sharp(frameBuffer).metadata();
          const imageWidth = metadata.width || 0;
          const imageHeight = metadata.height || 0;
          const currentImageSize = `${imageWidth}x${imageHeight}`;

          // Frame logging removed to reduce spam

          (this as any)[lastLogKey] = {
            time: now,
            size: frameBuffer.length,
            imageSize: currentImageSize,
          };
        } catch (error) {
          // Если не удалось декодировать, просто логируем размер данных
          // Frame logging removed to reduce spam
          (this as any)[lastLogKey] = {
            time: now,
            size: frameBuffer.length,
            imageSize: null,
          };
        }
      }

      // Интервальная калибровка: сохраняем последний кадр пока маппинг не создан
      // Это позволяет пользователю двигать камеру и использовать последний кадр для калибровки
      if (!this.chessRecognitionService.hasMapping(token)) {
        // Проверяем валидность кадра перед сохранением
        try {
          const metadata = await sharp(frameBuffer).metadata();
          const stats = await sharp(frameBuffer).stats();

          // Проверяем что кадр не пустой и не черный
          // Средняя яркость должна быть больше 10 (чтобы исключить черные кадры)
          const avgBrightness = stats.channels[0].mean; // Средняя яркость первого канала

          if (avgBrightness < 10) {
            this.logger.debug(
              `⚠️ [CALIBRATION] Skipping black/empty frame for token ${token} (avg brightness: ${avgBrightness.toFixed(1)})`,
            );
            // Не сохраняем черный кадр
          } else {
            // Сохраняем валидный кадр для калибровки
            this.lastCalibrationFrames.set(token, frameBuffer);
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ [CALIBRATION] Failed to validate frame for token ${token}: ${error.message}`,
          );
          // В случае ошибки валидации не сохраняем кадр
        }

        // Уведомляем пользователя только один раз
        if (!this.calibrationAttempted.get(token)) {
          this.calibrationAttempted.set(token, true);
          this.logger.log(
            `No mapping found for token ${token}, starting automatic calibration...`,
          );
          client.emit('calibration-started', {
            message:
              'Определение доски... Пожалуйста, подождите. Вы можете двигать камеру - будет использован последний кадр.',
          });

          // Запускаем периодическую автоматическую калибровку (каждые 5 секунд)
          this.startAutoCalibration(token, client);
        }
        // this.chessRecognitionService
        //   .calibrateBoard(token, frameBuffer)
        //   .then(async (calibrationResult) => {
        //     if (!calibrationResult.success) {
        //       client.emit('error', {
        //         message: `Калибровка не удалась: ${calibrationResult.message}. Видео продолжает транслироваться. Попробуйте улучшить освещение или использовать ручную калибровку.`,
        //       });
        //       // Не останавливаем трансляцию, просто логируем ошибку
        //       this.logger.warn(
        //         `Calibration failed for token ${token}: ${calibrationResult.message}. Streaming continues.`,
        //       );
        //     } else {
        //       client.emit('calibration-completed', {
        //         message: 'Board calibrated successfully',
        //         mappingData: calibrationResult.mappingData,
        //       });
        //       this.logger.log(`Calibration completed for token ${token}`);

        //       // Перезапускаем процесс обработки потока, чтобы он загрузил новый маппинг
        //       // Останавливаем старый процесс, если он был запущен до калибровки
        //       if (this.chessRecognitionService.hasActiveProcess(token)) {
        //         this.logger.log(
        //           `🔄 Restarting stream processing for token ${token} after calibration`,
        //         );
        //         this.chessRecognitionService.stopStreamProcessing(token);
        //         // Небольшая задержка, чтобы процесс успел остановиться
        //         await new Promise((resolve) => setTimeout(resolve, 100));
        //       }

        //       // Помечаем, что процесс запущен после калибровки
        //       this.processStartedAfterCalibration.set(token, true);

        //       // Запускаем процесс обработки с правильным callback
        //       const cwd = process.cwd();
        //       const projectRoot =
        //         cwd.endsWith('backend') ||
        //         cwd.endsWith('backend\\') ||
        //         cwd.endsWith('backend/')
        //           ? join(cwd, '..')
        //           : cwd;
        //       const defaultModelPath =
        //         process.env.YOLO_MODEL_PATH ||
        //         join(projectRoot, 'chess-recognition', 'bestmerged_new.pt');

        //       this.chessRecognitionService.startStreamProcessing(
        //         token,
        //         defaultModelPath,
        //         (result) => {
        //           // Логирование информации о детекциях
        //           if (result?.detections_info) {
        //             const detInfo = result.detections_info;
        //             if (detInfo.total_detections > 0) {
        //               const classesStr = Object.entries(
        //                 detInfo.classes_detected || {},
        //               )
        //                 .map(([cls, count]) => `${cls}: ${count}`)
        //                 .join(', ');
        //               this.logger.log(
        //                 `🔍 [DETECTION] Token ${token}: Found ${detInfo.total_detections} pieces (${classesStr})`,
        //               );
        //             } else {
        //               this.logger.debug(
        //                 `🔍 [DETECTION] Token ${token}: No pieces detected${detInfo.message ? ` - ${detInfo.message}` : ''}`,
        //               );
        //             }
        //           }

        //           // Отправляем результат стримеру
        //           client.emit('frame-processed', result);

        //           // И всем зрителям в комнате
        //           const roomId = `stream:${token}`;
        //           this.server.to(roomId).emit('frame-processed', result);

        //           if (result?.move) {
        //             this.logger.log(
        //               `♟️ Move detected for token ${token}: ${result.move} (${result.move_san || 'SAN?'})`,
        //             );
        //           }
        //         },
        //         (error) => {
        //           client.emit('error', { message: error.message });
        //         },
        //       );
        //     }
        //   })
        //   .catch((error) => {
        //     this.logger.error(
        //       `Calibration error for token ${token}:`,
        //       error.message,
        //     );
        //     client.emit('error', {
        //       message: `Ошибка калибровки: ${error.message}. Видео продолжает транслироваться.`,
        //     });
        //   });
      }

      // Запускаем обработку потока, если еще не запущена И маппинг уже есть
      // Если маппинга еще нет, процесс будет запущен после завершения калибровки
      // Не запускаем процесс, если он уже был запущен после калибровки или калибровка в процессе
      if (
        !this.chessRecognitionService.hasActiveProcess(token) &&
        this.chessRecognitionService.hasMapping(token) &&
        !this.processStartedAfterCalibration.get(token) &&
        !this.calibrationAttempted.get(token) // Не запускаем, если калибровка еще не завершена
      ) {
        const cwd = process.cwd();
        const projectRoot =
          cwd.endsWith('backend') ||
          cwd.endsWith('backend\\') ||
          cwd.endsWith('backend/')
            ? join(cwd, '..')
            : cwd;
        const defaultModelPath =
          process.env.YOLO_MODEL_PATH ||
          join(projectRoot, 'chess-recognition', 'bestmerged_new.pt');

        this.chessRecognitionService.startStreamProcessing(
          token,
          defaultModelPath,
          (result: FrameProcessedResult) => {
            // Логирование информации о детекциях
            if (result?.detections_info) {
              const detInfo = result.detections_info;
              if ((detInfo.total_detections ?? 0) > 0) {
                const classesStr = Object.entries(
                  detInfo.classes_detected || {},
                )
                  .map(([cls, count]) => `${cls}: ${count}`)
                  .join(', ');
                this.logger.log(
                  `🔍 [DETECTION] Token ${token}: Found ${detInfo.total_detections} pieces (${classesStr})`,
                );
              } else {
                // Логируем отсутствие детекций каждый кадр
                this.logger.log(
                  `🔍 [DETECTION] Token ${token}: No pieces detected${detInfo.message ? ` - ${detInfo.message}` : ''}`,
                );
              }
            }

            // Отправляем результат стримеру напрямую
            client.emit('frame-processed', result);

            // И всем зрителям в комнате (исключая стримера)
            const roomId = `stream:${token}`;
            client.to(roomId).emit('frame-processed', result);

            if (result?.move) {
              this.logger.log(
                `♟️ Move detected for token ${token}: ${result.move} (${result.move_san || 'SAN?'})`,
              );
            }
          },
          (error) => {
            client.emit('error', { message: error.message });
          },
        );
      }

      // Отправка бинарного кадра в процесс обработки
      try {
        // Логируем отправку кадра (периодически)
        const lastFrameSendKey = `frame_send_log_${token}`;
        const lastFrameSend = (this as any)[lastFrameSendKey] || { time: 0 };
        const now = Date.now();
        if (now - lastFrameSend.time > 2000) {
          this.logger.log(
            `📤 [FRAME] Sending frame to Python process: ${frameBuffer.length} bytes for token ${token}`,
          );
          (this as any)[lastFrameSendKey] = { time: now };
        }
        this.chessRecognitionService.sendFrame(token, frameBuffer);
      } catch (error) {
        this.logger.warn(
          `⚠️ [FRAME] Failed to send frame to Python process for token ${token}: ${error.message}`,
        );
      }

      // НЕ отправляем кадры через WebSocket для зрителей - теперь используется Mediasoup WebRTC
      // Кадры отправляются только для анализа (2 FPS), а для просмотра используется Mediasoup producer
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('stop-stream')
  handleStopStream(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;

    if (token) {
      this.chessRecognitionService.stopStreamProcessing(token);
    }

    // Убираем клиента из стримеров
    this.streamers.delete(client.id);
    // Очищаем флаги калибровки и процесса при остановке стрима
    if (token) {
      this.calibrationAttempted.delete(token);
      this.processStartedAfterCalibration.delete(token);
      this.lastCalibrationFrames.delete(token);
      // Останавливаем автоматическую калибровку
      this.stopAutoCalibration(token);
    }

    // Уведомляем всех в комнате, что стрим остановлен
    const roomId = `stream:${token}`;
    this.server.to(roomId).emit('stream-stopped', { token });

    this.clientGameTokens.delete(client.id);
    client.emit('stream-stopped', { token });
  }

  /**
   * Запуск периодической автоматической калибровки в фоне
   */
  private startAutoCalibration(
    token: string,
    client: Socket,
    intervalMs: number = 2000, // Каждые 2 секунды (было 5)
  ) {
    // Останавливаем предыдущий таймер, если есть
    this.stopAutoCalibration(token);

    // Запускаем новый таймер
    const timer = setInterval(async () => {
      // Проверяем, что маппинг еще не создан
      if (this.chessRecognitionService.hasMapping(token)) {
        this.stopAutoCalibration(token);
        return;
      }

      // Проверяем, что процесс уже не запущен после калибровки (защита от множественных рестартов)
      if (this.processStartedAfterCalibration.get(token)) {
        this.stopAutoCalibration(token);
        return;
      }

      // Берем последний сохраненный кадр
      const lastFrame = this.lastCalibrationFrames.get(token);
      if (!lastFrame) {
        this.logger.warn(
          `No frame available for auto calibration, token: ${token}`,
        );
        return;
      }

      try {
        this.logger.log(
          `🔄 [AUTO-CALIBRATION] Attempting automatic calibration for token ${token}`,
        );

        const calibrationResult =
          await this.chessRecognitionService.calibrateBoard(token, lastFrame);

        if (calibrationResult.success) {
          // Успешная калибровка!
          this.logger.log(
            `✅ [AUTO-CALIBRATION] Automatic calibration succeeded for token ${token}`,
          );

          // Останавливаем таймер СРАЗУ, чтобы избежать повторных срабатываний
          this.stopAutoCalibration(token);

          // Проверяем еще раз, что маппинг создан (защита от race condition)
          if (!this.chessRecognitionService.hasMapping(token)) {
            this.logger.warn(
              `⚠️ [AUTO-CALIBRATION] Mapping not found after successful calibration for token ${token}`,
            );
            return;
          }

          client.emit('calibration-completed', {
            message: 'Доска успешно определена автоматически',
            mappingData: calibrationResult.mappingData,
          });

          // Запускаем процесс обработки потока после успешной калибровки
          // Проверяем, что процесс еще не запущен (защита от множественных рестартов)
          if (this.processStartedAfterCalibration.get(token)) {
            this.logger.warn(
              `⚠️ [AUTO-CALIBRATION] Process already started after calibration for token ${token}, skipping restart`,
            );
            return;
          }

          if (this.chessRecognitionService.hasActiveProcess(token)) {
            this.logger.log(
              `🔄 Restarting stream processing for token ${token} after auto calibration`,
            );
            this.chessRecognitionService.stopStreamProcessing(token);
            // Увеличиваем задержку, чтобы процесс успел полностью закрыться
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Получаем путь к модели
          const cwd = process.cwd();
          const projectRoot =
            cwd.endsWith('backend') ||
            cwd.endsWith('backend\\') ||
            cwd.endsWith('backend/')
              ? join(cwd, '..')
              : cwd;
          const defaultModelPath =
            process.env.YOLO_MODEL_PATH ||
            join(projectRoot, 'chess-recognition', 'bestmerged_new.pt');

          // Устанавливаем флаг ДО запуска процесса (защита от race condition)
          this.processStartedAfterCalibration.set(token, true);

          this.chessRecognitionService.startStreamProcessing(
            token,
            defaultModelPath,
            (result: FrameProcessedResult) => {
              // Логирование информации о детекциях
              if (result?.detections_info) {
                const detInfo = result.detections_info;
                if ((detInfo.total_detections ?? 0) > 0) {
                  const classesStr = Object.entries(
                    detInfo.classes_detected || {},
                  )
                    .map(([cls, count]) => `${cls}: ${count}`)
                    .join(', ');
                  this.logger.log(
                    `🔍 [DETECTION] Token ${token}: Found ${detInfo.total_detections} pieces (${classesStr})`,
                  );
                } else {
                  this.logger.debug(
                    `🔍 [DETECTION] Token ${token}: No pieces detected${detInfo.message ? ` - ${detInfo.message}` : ''}`,
                  );
                }
              }

              // Отправляем результат стримеру
              client.emit('frame-processed', result);

              // И всем зрителям в комнате
              const roomId = `stream:${token}`;
              this.server.to(roomId).emit('frame-processed', result);

              if (result?.move) {
                this.logger.log(
                  `♟️ Move detected for token ${token}: ${result.move} (${result.move_san || 'SAN?'})`,
                );
              }
            },
            (error) => {
              client.emit('error', { message: error.message });
            },
          );
        } else {
          // Калибровка не удалась - продолжаем попытки (не показываем ошибку пользователю)
          this.logger.debug(
            `⚠️ [AUTO-CALIBRATION] Calibration attempt failed for token ${token}: ${calibrationResult.message}`,
          );
        }
      } catch (error) {
        // Ошибка при калибровке - продолжаем попытки (не показываем ошибку пользователю)
        this.logger.warn(
          `⚠️ [AUTO-CALIBRATION] Calibration error for token ${token}: ${(error as Error).message}`,
        );
      }
    }, intervalMs);

    this.autoCalibrationTimers.set(token, timer);
  }

  /**
   * Остановка автоматической калибровки
   */
  private stopAutoCalibration(token: string) {
    const timer = this.autoCalibrationTimers.get(token);
    if (timer) {
      clearInterval(timer);
      this.autoCalibrationTimers.delete(token);
      this.logger.log(
        `🛑 [AUTO-CALIBRATION] Stopped automatic calibration for token ${token}`,
      );
    }
  }

}
