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
import { ChessRecognitionService } from './chess-recognition.service';
import { MediasoupService } from './mediasoup.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chess-stream',
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
  private readonly calibrationAttempted: Map<string, boolean> = new Map(); // token -> attempted (чтобы калибровка запускалась только один раз)

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
  handleJoinStream(
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
      // Очищаем флаг калибровки при отключении стримера
      if (gameToken) {
        this.calibrationAttempted.delete(gameToken);
      }
      this.logger.log(
        `Streamer ${client.id} disconnected, stopping stream for token ${gameToken}`,
      );
    }

    if (roomId) {
      this.mediasoupService.closeRoom(roomId);
      this.clientRooms.delete(client.id);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('start-stream')
  handleStartStream(
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

    // Запуск обработки потока
    this.chessRecognitionService.startStreamProcessing(
      token,
      modelPath || defaultModelPath,
      (result) => {
        // Отправка результата клиенту
        client.emit('frame-processed', result);
      },
      (error) => {
        client.emit('error', { message: error.message });
      },
    );

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

    try {
      const rtpCapabilities =
        await this.mediasoupService.getRouterRtpCapabilities(token);
      client.emit('router-rtp-capabilities', rtpCapabilities);
    } catch (error) {
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

    try {
      const producer = await this.mediasoupService.createProducer(
        token,
        client.id,
        transportId,
        rtpParameters,
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
        join(
          projectRoot,
          'chess-recognition',
          'assets',
          'models',
          'chess_pieces_yolo11_n_best.pt',
        );

      this.chessRecognitionService.startStreamProcessing(
        token,
        defaultModelPath,
        (result) => {
          client.emit('frame-processed', result);
        },
        (error) => {
          client.emit('error', { message: error.message });
        },
      );

      this.clientGameTokens.set(client.id, token);
      client.emit('produced', producer);
    } catch (error) {
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

    this.logger.debug(
      `📹 [STREAMER] Received frame from client ${client.id} for token ${token}, frame size: ${Array.isArray(frame) ? frame.length : frame.length || 'unknown'}`,
    );

    try {
      // Конвертируем в Buffer если нужно
      const frameBuffer = Buffer.isBuffer(frame)
        ? frame
        : Buffer.from(frame as Uint8Array | number[]);

      // Проверяем наличие маппинга при первом кадре (только один раз)
      if (
        !this.chessRecognitionService.hasMapping(token) &&
        !this.calibrationAttempted.get(token)
      ) {
        this.calibrationAttempted.set(token, true);
        this.logger.log(
          `No mapping found for token ${token}, starting calibration...`,
        );
        client.emit('calibration-started', {
          message: 'Starting board calibration...',
        });

        // Запускаем калибровку на первом кадре (асинхронно, не блокируем трансляцию)
        this.chessRecognitionService
          .calibrateBoard(token, frameBuffer)
          .then((calibrationResult) => {
            if (!calibrationResult.success) {
              client.emit('error', {
                message: `Calibration failed: ${calibrationResult.message}. Please ensure the board is empty. Video will still stream.`,
              });
              // Не останавливаем трансляцию, просто логируем ошибку
              this.logger.warn(
                `Calibration failed for token ${token}, but streaming continues`,
              );
            } else {
              client.emit('calibration-completed', {
                message: 'Board calibrated successfully',
                mappingData: calibrationResult.mappingData,
              });
              this.logger.log(`Calibration completed for token ${token}`);
            }
          })
          .catch((error) => {
            this.logger.error(
              `Calibration error for token ${token}:`,
              error.message,
            );
            client.emit('error', {
              message: `Calibration error: ${error.message}. Video will still stream.`,
            });
          });
      }

      // Отправка бинарного кадра в процесс обработки
      this.chessRecognitionService.sendFrame(token, frameBuffer);

      // Транслируем кадр всем клиентам в комнате (кроме отправителя)
      // Конвертируем Buffer в base64 для передачи через WebSocket
      const frameBase64 = frameBuffer.toString('base64');
      const roomId = `stream:${token}`;

      // Получаем список клиентов в комнате для логирования
      let clientsInRoom = 0;
      try {
        const adapter = this.server.sockets.adapter;
        if (adapter && adapter.rooms) {
          const room = adapter.rooms.get(roomId);
          clientsInRoom = room ? Array.from(room).length : 0;
        }
      } catch (error) {
        this.logger.warn(
          `Could not get room info for ${roomId}:`,
          error.message,
        );
        // Продолжаем работу даже если не удалось получить информацию о комнате
      }

      // Отправляем кадр всем в комнате, кроме отправителя
      this.logger.log(
        `📹 Broadcasting frame to room ${roomId} (${clientsInRoom} clients), frame size: ${frameBase64.length} bytes, excluding sender ${client.id}`,
      );

      client.to(roomId).emit('video-frame', {
        token,
        frame: frameBase64,
      });

      this.logger.log(`✅ Frame broadcasted to room ${roomId}`);
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
    // Очищаем флаг калибровки при остановке стрима
    if (token) {
      this.calibrationAttempted.delete(token);
    }

    // Уведомляем всех в комнате, что стрим остановлен
    const roomId = `stream:${token}`;
    this.server.to(roomId).emit('stream-stopped', { token });

    this.clientGameTokens.delete(client.id);
    client.emit('stream-stopped', { token });
  }
}
