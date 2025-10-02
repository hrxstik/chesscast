import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

@Injectable()
export class StockfishService implements OnModuleInit, OnModuleDestroy {
  private stockfish: ChildProcessWithoutNullStreams;
  private bestMoveCallback: ((move: string) => void) | null = null;
  constructor(private configService: ConfigService) {}
  onModuleInit() {
    const path = this.configService.get<string>('STOCKFISH_PATH');
    this.stockfish = spawn(path as string);

    this.stockfish.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Stockfish output:', output);

      const match = output.match(/bestmove\s([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (match) {
        const bestMove = match[1];
        if (this.bestMoveCallback) {
          this.bestMoveCallback(bestMove);
        }
      }
    });
    this.stockfish.stderr.on('data', (data) => {
      console.error('Stockfish error:', data.toString());
    });

    this.stockfish.on('close', (code) => {
      console.log(`Stockfish exited with code ${code}`);
    });

    this.stockfish.stdin.write('uci\n');
  }

  onModuleDestroy() {
    this.stockfish.kill();
  }

  sendMovesToStockfish(moves: string[]): Promise<string> {
    return new Promise((resolve) => {
      this.bestMoveCallback = (bestMove: string) => {
        resolve(bestMove);
        this.bestMoveCallback = null;
      };

      const command = `position startpos moves ${moves.join(' ')}`;
      this.stockfish.stdin.write(command + '\n');
      this.stockfish.stdin.write('go depth 15\n');
    });
  }
}
