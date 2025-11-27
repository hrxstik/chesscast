import { Module } from '@nestjs/common';
import { ChessRecognitionService } from './chess-recognition.service';
import { ChessRecognitionController } from './chess-recognition.controller';
import { ChessRecognitionGateway } from './chess-recognition.gateway';

@Module({
  providers: [ChessRecognitionService, ChessRecognitionGateway],
  controllers: [ChessRecognitionController],
  exports: [ChessRecognitionService],
})
export class ChessRecognitionModule {}


