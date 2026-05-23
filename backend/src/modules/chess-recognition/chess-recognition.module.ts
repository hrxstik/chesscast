import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChessRecognitionService } from './chess-recognition.service';
import { ChessRecognitionController } from './chess-recognition.controller';
import { ChessRecognitionGateway } from './chess-recognition.gateway';
import { MediasoupService } from './mediasoup.service';
import { GameModule } from '../game/game.module';

@Module({
  imports: [forwardRef(() => GameModule), JwtModule],
  providers: [ChessRecognitionService, ChessRecognitionGateway, MediasoupService],
  controllers: [ChessRecognitionController],
  exports: [ChessRecognitionService, MediasoupService, ChessRecognitionGateway],
})
export class ChessRecognitionModule {}


