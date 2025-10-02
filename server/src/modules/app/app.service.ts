import { Injectable } from '@nestjs/common';
import { StockfishService } from 'src/stockfish.service';

@Injectable()
export class AppService {
  constructor(private stockfishService: StockfishService) {}

  async analyzePosition() {
    const moves = ['e2e4', 'e7e5'];
    const bestMove = await this.stockfishService.sendMovesToStockfish(moves);
    console.log('Best move from Stockfish:', bestMove);
    return bestMove;
  }
}
