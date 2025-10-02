import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StockfishService } from '../../stockfish.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [StockfishService, AppService],
})
export class AppModule {}
