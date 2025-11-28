import { Module } from '@nestjs/common';
import { ChessRecognitionService } from './chess-recognition.service';
import { ChessRecognitionController } from './chess-recognition.controller';
import { ChessRecognitionGateway } from './chess-recognition.gateway';
import { MediasoupService } from './mediasoup.service';

@Module({
  providers: [ChessRecognitionService, ChessRecognitionGateway, MediasoupService],
  controllers: [ChessRecognitionController],
  exports: [ChessRecognitionService, MediasoupService],
})
export class ChessRecognitionModule {}


