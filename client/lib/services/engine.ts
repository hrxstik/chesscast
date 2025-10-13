type EngineMessage = {
  uciMessage: string;
  bestMove?: string;
  ponder?: string;
  positionEvaluation?: string;
  possibleMate?: string;
  pv?: string;
  depth?: number;
};

export default class Engine {
  private stockfish: Worker | null = null;
  private messageCallbacks: ((message: EngineMessage) => void)[] = [];
  public isReady: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private async init() {
    try {
      this.stockfish = new Worker('/engine/stockfish.wasm.js');

      this.stockfish.addEventListener('message', (e) => {
        const message = this.transformSFMessageData(e);
        this.messageCallbacks.forEach((callback) => callback(message));
      });

      await this.initializeEngine();
    } catch (error) {
      console.error('Failed to initialize engine:', error);
    }
  }

  private initializeEngine(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.stockfish) {
        resolve();
        return;
      }

      this.stockfish.postMessage('uci');
      this.stockfish.postMessage('isready');

      const readyHandler = (message: EngineMessage) => {
        if (message.uciMessage === 'readyok') {
          this.isReady = true;
          this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== readyHandler);
          resolve();
        }
      };

      this.messageCallbacks.push(readyHandler);
    });
  }

  private transformSFMessageData(e: MessageEvent<string>): EngineMessage {
    const uciMessage = e?.data ?? e;

    return {
      uciMessage,
      bestMove: uciMessage.match(/bestmove\s+(\S+)/)?.[1],
      ponder: uciMessage.match(/ponder\s+(\S+)/)?.[1],
      positionEvaluation: uciMessage.match(/cp\s+(\S+)/)?.[1],
      possibleMate: uciMessage.match(/mate\s+(\S+)/)?.[1],
      pv: uciMessage.match(/ pv\s+(.*)/)?.[1],
      depth: Number(uciMessage.match(/ depth\s+(\S+)/)?.[1] ?? 0),
    };
  }

  onMessage(callback: (message: EngineMessage) => void) {
    this.messageCallbacks.push(callback);
  }

  async evaluatePosition(fen: string, depth = 12) {
    if (!this.stockfish || !this.isReady) {
      console.warn('Engine not ready yet');
      return;
    }

    if (depth > 24) depth = 24;

    this.stockfish.postMessage(`position fen ${fen}`);
    this.stockfish.postMessage(`go depth ${depth}`);
  }

  stop() {
    if (this.stockfish) {
      this.stockfish.postMessage('stop');
    }
  }

  terminate() {
    this.isReady = false;
    if (this.stockfish) {
      this.stockfish.postMessage('quit');
    }
  }
}
