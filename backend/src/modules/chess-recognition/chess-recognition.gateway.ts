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
import { JwtService } from '@nestjs/jwt';
import { join } from 'path';
import { AUTH_COOKIE_NAMES } from '../../auth/auth-cookie.constants';
import {
  ChessRecognitionService,
  type FrameProcessedResult,
} from './chess-recognition.service';
import { MediasoupService } from './mediasoup.service';
import { GameService } from '../game/game.service';
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
  /** До завершения калибровки в этой сессии стрима — не используем старый маппинг. */
  private readonly recalibrationPending = new Set<string>();
  private readonly cvFrameSkipLogAt = new Map<string, number>();

  constructor(
    private readonly chessRecognitionService: ChessRecognitionService,
    private readonly mediasoupService: MediasoupService,
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {
    // Инициализация mediasoup worker
    this.mediasoupService.initializeWorker();
  }

  private parseJwtUserId(sub: unknown): number | null {
    if (typeof sub === 'number' && Number.isFinite(sub)) {
      return sub;
    }
    if (typeof sub === 'string' && sub.trim()) {
      const n = Number(sub);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private async verifyWsCredential(token: string): Promise<number | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number | string;
        typ?: string;
      }>(token);
      const userId = this.parseJwtUserId(payload.sub);
      if (userId == null) {
        this.logger.warn('WS credential: invalid sub in JWT');
        return null;
      }
      return userId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS credential verify failed: ${msg}`);
    }
    return null;
  }

  private async resolveSocketUserId(client: Socket): Promise<number | null> {
    const auth = client.handshake.auth as { ticket?: string } | undefined;
    const queryToken = client.handshake.query?.token;
    const tokenFromQuery =
      typeof queryToken === 'string'
        ? queryToken
        : Array.isArray(queryToken)
          ? queryToken[0]
          : undefined;

    if (tokenFromQuery) {
      const userId = await this.verifyWsCredential(tokenFromQuery);
      if (userId != null) return userId;
    }

    if (auth?.ticket) {
      const userId = await this.verifyWsCredential(auth.ticket);
      if (userId != null) return userId;
    }

    const bearer = client.handshake.headers.authorization;
    if (typeof bearer === 'string' && bearer.startsWith('Bearer ')) {
      try {
        const token = bearer.slice(7).trim();
        const payload = await this.jwtService.verifyAsync<{ sub: number | string }>(
          token,
        );
        const userId = this.parseJwtUserId(payload.sub);
        if (userId != null) return userId;
      } catch {
        /* fall through */
      }
    }

    try {
      const raw =
        client.handshake.headers.cookie ??
        (client.request as { headers?: { cookie?: string } })?.headers?.cookie;
      if (!raw) return null;
      const cookies = Object.fromEntries(
        raw.split(';').map((part) => {
          const [key, ...rest] = part.trim().split('=');
          return [key, decodeURIComponent(rest.join('='))];
        }),
      );
      const access = cookies[AUTH_COOKIE_NAMES.access];
      if (!access) return null;
      const payload = await this.jwtService.verifyAsync<{ sub: number | string }>(
        access,
      );
      return this.parseJwtUserId(payload.sub);
    } catch {
      return null;
    }
  }

  /** Завершение партии: уведомить комнату, остановить CV и WebRTC. */
  broadcastGameFinished(token: string, result?: string): void {
    this.chessRecognitionService.stopStreamProcessing(token);
    void this.mediasoupService.closeStreamMedia(token).catch(() => undefined);
    const roomId = `stream:${token}`;
    this.server.to(roomId).emit('game-finished', { token, result });
  }

  private deliverFrameProcessed(
    token: string,
    client: Socket,
    result: FrameProcessedResult,
    options: { toRoom?: boolean },
  ): void {
    if (result.board_snapshot !== true) {
      return;
    }

    client.emit('frame-processed', result);

    if (options.toRoom) {
      const roomId = `stream:${token}`;
      client.to(roomId).emit('frame-processed', result);
    }
  }

  handleConnection(client: Socket) {
    void this.resolveSocketUserId(client);
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

    const userId = await this.resolveSocketUserId(client);
    try {
      await this.gameService.assertCanJoinStreamRoom(token, userId ?? undefined);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Нет доступа к трансляции';
      this.logger.warn(
        `👀 [VIEWER] join-stream denied for client ${client.id}, token ${token}: ${msg}`,
      );
      client.emit('error', { message: msg });
      return;
    }

    // Присоединяем клиента к комнате по token
    const roomId = `stream:${token}`;
    client.join(roomId);
    this.clientGameTokens.set(client.id, token);

    // Проверяем, есть ли уже producer в комнате mediasoup
    try {
      const producers = await this.mediasoupService.getProducers(token);
      if (producers.length > 0) {
        client.emit('producers', producers);
      }
    } catch (error) {
      this.logger.warn(`Failed to get producers for viewer: ${error.message}`);
    }

    const sync = await this.gameService.getStreamSyncState(token);
    client.emit('stream-joined', { token, ...sync });
  }

  handleDisconnect(client: Socket) {
    const gameToken = this.clientGameTokens.get(client.id);
    const roomId = this.clientRooms.get(client.id);
    const isStreamer = this.streamers.has(client.id);

    if (gameToken) {
      this.mediasoupService.closeClientMedia(gameToken, client.id);
      // Останавливаем обработку только если это был стример
      if (isStreamer) {
        this.chessRecognitionService.stopStreamProcessing(gameToken);
      }
      this.clientGameTokens.delete(client.id);
    }

    if (isStreamer) {
      if (gameToken) {
        this.stopStreamForToken(gameToken);
      }
    } else {
      if (roomId) {
        this.clientRooms.delete(client.id);
      }
    }
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

    const userId = await this.resolveSocketUserId(client);
    if (userId == null) {
      this.logger.warn(
        `📹 [STREAMER] start-stream rejected: no auth for client ${client.id}, token ${token}`,
      );
      client.emit('error', { message: 'Требуется авторизация для трансляции' });
      return;
    }
    try {
      await this.gameService.assertCreatorCanStream(userId, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Нет доступа к трансляции';
      this.logger.warn(
        `📹 [STREAMER] start-stream rejected for client ${client.id}, token ${token}: ${msg}`,
      );
      client.emit('error', { message: msg });
      return;
    }

    // Каждый старт стрима — новая калибровка (камера могла съехать)
    this.chessRecognitionService.stopStreamProcessing(token);
    this.stopAutoCalibration(token);
    this.calibrationAttempted.delete(token);
    this.processStartedAfterCalibration.delete(token);
    this.lastCalibrationFrames.delete(token);
    this.recalibrationPending.add(token);
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

    const sync = await this.gameService.getStreamSyncState(token);
    const payload = {
      token,
      ...sync,
      boardCalibrated: false,
    };
    client.emit('stream-started', payload);
    this.server.to(roomId).emit('stream-started', payload);
    this.server.to(roomId).emit('calibration-started', {
      message:
        'Определение доски… Подождите несколько секунд, можно слегка подвигать камеру.',
    });
  }

  @SubscribeMessage('start-game')
  async handleStartGame(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;
    if (!token) {
      client.emit('error', { message: 'Token is required' });
      return;
    }
    const userId = await this.resolveSocketUserId(client);
    if (userId == null) {
      client.emit('error', { message: 'Требуется авторизация' });
      return;
    }
    try {
      await this.gameService.assertCreatorCanStream(userId, token);
      if (
        !this.chessRecognitionService.hasValidMapping(token) ||
        this.recalibrationPending.has(token)
      ) {
        client.emit('error', {
          message:
            'Сначала откалибруйте доску: запустите видеопоток и дождитесь завершения калибровки',
        });
        return;
      }
      await this.gameService.markInProgressByToken(token);
    } catch (e) {
      client.emit('error', {
        message: e instanceof Error ? e.message : 'Не удалось начать партию',
      });
      return;
    }
    const roomId = `stream:${token}`;
    this.server.to(roomId).emit('game-started', { token });
    client.emit('game-started', { token });
  }

  @SubscribeMessage('report-move')
  async handleReportMove(
    @MessageBody() data: { token: string; san: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, san } = data;
    if (!token || !san?.trim()) {
      return;
    }
    const userId = await this.resolveSocketUserId(client);
    if (userId == null) {
      return;
    }
    try {
      await this.gameService.assertCreatorCanStream(userId, token);
      const outcome = await this.gameService.appendSanMoveByToken(
        token,
        san.trim(),
      );
      if (outcome?.autoFinished && outcome.result) {
        this.broadcastGameFinished(token, outcome.result);
      }
    } catch {
      /* ignore */
    }
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
    @MessageBody() data: { token: string; transportId: string; dtlsParameters: any },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, transportId, dtlsParameters } = data;
    if (!token || !transportId || !dtlsParameters) {
      client.emit('error', {
        message: 'Token, transportId and dtlsParameters are required',
      });
      return;
    }

    try {
      await this.mediasoupService.connectTransport(
        token,
        transportId,
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
      // Убеждаемся, что комната существует перед созданием producer
      await this.mediasoupService.createRoom(token);

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
        join(projectRoot, 'chess-recognition', 'models', 'bestmerged_new.pt');

      // Запускаем обработку потока только если еще не запущена И маппинг уже есть
      // Если маппинга еще нет, процесс будет запущен после завершения калибровки в handleFrame
      if (
        !this.chessRecognitionService.hasActiveProcess(token) &&
        this.chessRecognitionService.hasValidMapping(token) &&
        !this.recalibrationPending.has(token)
      ) {
        this.chessRecognitionService.startStreamProcessing(
          token,
          defaultModelPath,
          (result: FrameProcessedResult) => {
            this.deliverFrameProcessed(token, client, result, { toRoom: true });
          },
          (error) => {
            client.emit('error', { message: error.message });
          },
        );
      }

      this.clientGameTokens.set(client.id, token);
      this.streamers.set(client.id, token); // Помечаем как стримера

      // Уведомляем всех в комнате о новом producer
      const roomId = `stream:${token}`;

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

    try {
      const consumer = await this.mediasoupService.createConsumer(
        token,
        client.id,
        transportId,
        producerId,
        rtpCapabilities,
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

    try {
      await this.mediasoupService.resumeConsumer(token, consumerId);
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

    try {
      try {
        await this.mediasoupService.getRouterRtpCapabilities(token);
      } catch {
        await this.mediasoupService.createRoom(token);
      }

      const producers = await this.mediasoupService.getProducers(token);
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
      if (this.recalibrationPending.has(token)) {
        // Проверяем валидность кадра перед сохранением
        try {
          const metadata = await sharp(frameBuffer).metadata();
          const stats = await sharp(frameBuffer).stats();

          // Проверяем что кадр не пустой и не черный
          // Средняя яркость должна быть больше 10 (чтобы исключить черные кадры)
          const avgBrightness = stats.channels[0].mean; // Средняя яркость первого канала

          if (avgBrightness < 5) {
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
        //         join(projectRoot, 'chess-recognition', 'models', 'bestmerged_new.pt');

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
        this.chessRecognitionService.hasValidMapping(token) &&
        !this.recalibrationPending.has(token)
      ) {
        this.processStartedAfterCalibration.set(token, true);
        const cwd = process.cwd();
        const projectRoot =
          cwd.endsWith('backend') ||
          cwd.endsWith('backend\\') ||
          cwd.endsWith('backend/')
            ? join(cwd, '..')
            : cwd;
        const defaultModelPath =
          process.env.YOLO_MODEL_PATH ||
          join(projectRoot, 'chess-recognition', 'models', 'bestmerged_new.pt');

        this.chessRecognitionService.startStreamProcessing(
          token,
          defaultModelPath,
          (result: FrameProcessedResult) => {
            this.deliverFrameProcessed(token, client, result, { toRoom: true });
          },
          (error) => {
            client.emit('error', { message: error.message });
          },
        );
      }

      // Отправка бинарного кадра в процесс обработки
      try {
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

  /** Остановка CV/WebRTC для всех в комнате (телефон + ПК). */
  private stopStreamForToken(token: string): void {
    if (token) {
      this.chessRecognitionService.stopStreamProcessing(token);
      void this.mediasoupService.closeStreamMedia(token).catch(() => undefined);
      this.calibrationAttempted.delete(token);
      this.processStartedAfterCalibration.delete(token);
      this.lastCalibrationFrames.delete(token);
      this.cvFrameSkipLogAt.delete(token);
      this.recalibrationPending.delete(token);
      this.stopAutoCalibration(token);
    }
    for (const [clientId, t] of [...this.streamers.entries()]) {
      if (t === token) {
        this.streamers.delete(clientId);
      }
    }
    const roomId = `stream:${token}`;
    this.server.to(roomId).emit('stream-stopped', { token });
  }

  @SubscribeMessage('stop-stream')
  async handleStopStream(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token } = data;
    if (!token) {
      return;
    }

    const isStreamer = this.streamers.get(client.id) === token;
    if (isStreamer) {
      this.stopStreamForToken(token);
      this.clientGameTokens.delete(client.id);
      client.emit('stream-stopped', { token });
      return;
    }

    const userId = await this.resolveSocketUserId(client);
    if (userId != null) {
      try {
        await this.gameService.assertCreatorOwnsGame(userId, token);
        this.stopStreamForToken(token);
        client.emit('stream-stopped', { token });
        return;
      } catch {
        /* не создатель — только отключить себя */
      }
    }

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
      if (this.chessRecognitionService.hasValidMapping(token)) {
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
        const calibrationResult =
          await this.chessRecognitionService.calibrateBoard(token, lastFrame, {
            force: true,
          });

        if (calibrationResult.success) {
          // Останавливаем таймер СРАЗУ, чтобы избежать повторных срабатываний
          this.stopAutoCalibration(token);
          this.calibrationAttempted.delete(token);
          this.recalibrationPending.delete(token);

          // Проверяем еще раз, что маппинг создан (защита от race condition)
          if (!this.chessRecognitionService.hasValidMapping(token)) {
            this.logger.warn(
              `⚠️ [AUTO-CALIBRATION] Mapping not found after successful calibration for token ${token}`,
            );
            return;
          }

          const roomId = `stream:${token}`;
          this.server.to(roomId).emit('calibration-completed', {
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
            join(projectRoot, 'chess-recognition', 'models', 'bestmerged_new.pt');

          // Устанавливаем флаг ДО запуска процесса (защита от race condition)
          this.processStartedAfterCalibration.set(token, true);

          this.chessRecognitionService.startStreamProcessing(
            token,
            defaultModelPath,
            (result: FrameProcessedResult) => {
              this.deliverFrameProcessed(token, client, result, { toRoom: true });
            },
            (error) => {
              client.emit('error', { message: error.message });
            },
          );
        } else {
          const failKey = `cal_fail_emit_${token}`;
          const lastFail = (this as any)[failKey] as number | undefined;
          const now = Date.now();
          if (!lastFail || now - lastFail > 12000) {
            (this as any)[failKey] = now;
            const roomId = `stream:${token}`;
            this.server.to(roomId).emit('calibration-failed', {
              message:
                calibrationResult.message ||
                'Не удалось определить доску. Наведите камеру на доску целиком.',
            });
          }
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
    }
  }

}
