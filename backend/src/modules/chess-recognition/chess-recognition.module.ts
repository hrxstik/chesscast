import { Module, forwardRef } from '@nestjs/common';
import { ChessRecognitionService } from './chess-recognition.service';
import { ChessRecognitionController } from './chess-recognition.controller';
import { ChessRecognitionGateway } from './chess-recognition.gateway';
import { MediasoupService } from './mediasoup.service';
import { GameModule } from '../game/game.module';

@Module({
  imports: [forwardRef(() => GameModule)],
  providers: [ChessRecognitionService, ChessRecognitionGateway, MediasoupService],
  controllers: [ChessRecognitionController],
  exports: [ChessRecognitionService, MediasoupService, ChessRecognitionGateway],
})
export class ChessRecognitionModule {}


