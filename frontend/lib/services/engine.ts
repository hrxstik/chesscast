export type EngineMessage = {
  uciMessage: string;
  bestMove?: string;
  ponder?: string;
  positionEvaluation?: string;
  possibleMate?: string;
  pv?: string;
  depth?: number;
  /** 1..N при MultiPV */
  multipv?: number;
};

export type EvaluateOptions = {
  /** Фиксированное время на позицию (как chess.com live). */
  movetimeMs?: number;
  depth?: number;
  multiPv?: number;
};

export default class Engine {
  stockfish: Worker;
  onMessage: (callback: (messageData: EngineMessage) => void) => void;
  isReady: boolean;
  private multiPvConfigured = 0;

  constructor() {
    this.stockfish = new Worker('/engine/stockfish.wasm.js');

    this.isReady = false;
    this.onMessage = (callback) => {
      this.stockfish.addEventListener('message', (e) => {
        callback(this.transformSFMessageData(e));
      });
    };
    this.init();
  }

  init() {
    this.stockfish.postMessage('uci');
    this.stockfish.postMessage('isready');
    this.onMessage(({ uciMessage }) => {
      if (uciMessage === 'readyok') {
        this.isReady = true;
      }
    });
  }

  private transformSFMessageData(e: MessageEvent<string>): EngineMessage {
    const uciMessage = e?.data ?? e;

    const multipvRaw = uciMessage.match(/\bmultipv\s+(\d+)/)?.[1];
    const multipv = multipvRaw ? Number(multipvRaw) : undefined;

    const cp = uciMessage.match(/\bscore cp (-?\d+)/)?.[1];
    const mate = uciMessage.match(/\bscore mate (-?\d+)/)?.[1];

    return {
      uciMessage,
      bestMove: uciMessage.match(/bestmove\s+(\S+)/)?.[1],
      ponder: uciMessage.match(/ponder\s+(\S+)/)?.[1],
      positionEvaluation: cp,
      possibleMate: mate,
      pv: uciMessage.match(/\bpv\s+(.+)/)?.[1]?.trim(),
      depth: Number(uciMessage.match(/\bdepth\s+(\d+)/)?.[1] ?? 0),
      multipv,
    };
  }

  evaluatePosition(fen: string, opts: EvaluateOptions = {}) {
    const multiPv = opts.multiPv ?? 1;
    const movetimeMs = opts.movetimeMs;
    const depth = opts.depth ?? 16;

    if (multiPv !== this.multiPvConfigured) {
      const n = Math.min(Math.max(1, multiPv), 5);
      this.stockfish.postMessage(`setoption name MultiPV value ${n}`);
      this.multiPvConfigured = n;
    }

    this.stockfish.postMessage('stop');
    this.stockfish.postMessage(`position fen ${fen}`);
    if (movetimeMs != null && movetimeMs > 0) {
      this.stockfish.postMessage(`go movetime ${Math.min(movetimeMs, 3000)}`);
    } else {
      const d = Math.min(Math.max(depth, 1), 24);
      this.stockfish.postMessage(`go depth ${d}`);
    }
  }

  stop() {
    this.stockfish.postMessage('stop');
  }

  terminate() {
    this.isReady = false;
    this.stockfish.postMessage('quit');
  }
}
