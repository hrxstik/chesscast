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
import { ChessRecognitionService } from './chess-recognition.service';

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

  constructor(
    private readonly chessRecognitionService: ChessRecognitionService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const gameToken = this.clientGameTokens.get(client.id);
    if (gameToken) {
      this.chessRecognitionService.stopStreamProcessing(gameToken);
      this.clientGameTokens.delete(client.id);
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

    // Проверка наличия маппинга
    if (!this.chessRecognitionService.hasMapping(token)) {
      client.emit('error', {
        message: 'Board mapping not found. Please calibrate first.',
      });
      return;
    }

    // Путь к модели по умолчанию
    const defaultModelPath =
      process.env.YOLO_MODEL_PATH ||
      './chess-recognition/assets/models/chess_pieces_yolo11_n_best.pt';

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

  @SubscribeMessage('frame')
  handleFrame(
    @MessageBody() data: { token: string; frame: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { token, frame } = data;

    if (!token || !frame) {
      client.emit('error', { message: 'Token and frame are required' });
      return;
    }

    try {
      // Отправка кадра в процесс обработки
      this.chessRecognitionService.sendFrame(token, frame);
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


