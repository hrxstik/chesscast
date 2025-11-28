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

  handleDisconnect(client: Socket) {
    const gameToken = this.clientGameTokens.get(client.id);
    const roomId = this.clientRooms.get(client.id);

    if (gameToken) {
      this.chessRecognitionService.stopStreamProcessing(gameToken);
      this.clientGameTokens.delete(client.id);
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

    try {
      // Конвертируем в Buffer если нужно
      const frameBuffer = Buffer.isBuffer(frame)
        ? frame
        : Buffer.from(frame as Uint8Array | number[]);

      // Проверяем наличие маппинга при первом кадре
      if (!this.chessRecognitionService.hasMapping(token)) {
        this.logger.log(
          `No mapping found for token ${token}, starting calibration...`,
        );
        client.emit('calibration-started', {
          message: 'Starting board calibration...',
        });

        // Запускаем калибровку на первом кадре
        const calibrationResult =
          await this.chessRecognitionService.calibrateBoard(token, frameBuffer);

        if (!calibrationResult.success) {
          client.emit('error', {
            message: `Calibration failed: ${calibrationResult.message}. Please ensure the board is empty.`,
          });
          return;
        }

        client.emit('calibration-completed', {
          message: 'Board calibrated successfully',
          mappingData: calibrationResult.mappingData,
        });
        this.logger.log(`Calibration completed for token ${token}`);
      }

      // Отправка бинарного кадра в процесс обработки
      this.chessRecognitionService.sendFrame(token, frameBuffer);
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

    this.clientGameTokens.delete(client.id);
    client.emit('stream-stopped', { token });
  }
}
