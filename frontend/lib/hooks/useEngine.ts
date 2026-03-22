'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessboardOptions, PieceDropHandlerArgs } from 'react-chessboard';
import Engine, { EngineMessage } from '@/lib/services/engine';

export type EnginePvRow = {
  rank: number;
  scoreLabel: string;
  pv: string;
};

type UseEngineOptions = {
  /** Stockfish MultiPV (1 = только первая линия) */
  multiPv?: number;
};

interface UseEngineReturn {
  chessPosition: string;
  positionEvaluation: number;
  engineReady: boolean;
  depth: number;
  bestLine: string;
  possibleMate: string;
  bestMove: string | undefined;
  /** Заполнено при multiPv > 1 */
  pvRows: EnginePvRow[];
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  chessboardOptions: ChessboardOptions;
  applyExternalMove: (uciMove: string) => void;
  setPositionFromFen: (fen: string) => void;
}

export function useEngine(initialFen?: string, opts?: UseEngineOptions): UseEngineReturn {
  const multiPv = opts?.multiPv ?? 1;
  const engineRef = useRef<Engine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  let initialChess: Chess;
  try {
    initialChess = new Chess(initialFen);
  } catch {
    initialChess = new Chess();
  }
  const chessGameRef = useRef(initialChess);

  const [chessPosition, setChessPosition] = useState(chessGameRef.current.fen());
  const [positionEvaluation, setPositionEvaluation] = useState(0);
  const [depth, setDepth] = useState(10);
  const [bestLine, setBestLine] = useState('');
  const [possibleMate, setPossibleMate] = useState('');
  const [pvRows, setPvRows] = useState<EnginePvRow[]>([]);
  const pvMapRef = useRef<
    Map<number, { scoreLabel: string; pv: string; depth: number; mate?: string; cp?: string }>
  >(new Map());

  useEffect(() => {
    const engineInstance = new Engine();
    engineRef.current = engineInstance;

    engineInstance.onMessage((message: EngineMessage) => {
      if (message.depth && message.depth < 10) return;

      const idx = message.multipv ?? 1;

      if (multiPv > 1) {
        if (message.pv) {
          const mate = message.possibleMate;
          const cp = message.positionEvaluation;
          let scoreLabel = '…';
          if (mate !== undefined) scoreLabel = `#${mate}`;
          else if (cp !== undefined) {
            const signed =
              (chessGameRef.current.turn() === 'w' ? 1 : -1) * (Number(cp) / 100);
            scoreLabel = signed >= 0 ? `+${signed.toFixed(2)}` : signed.toFixed(2);
          }
          const prev = pvMapRef.current.get(idx);
          const d = message.depth ?? prev?.depth ?? 0;
          if (!prev || d >= prev.depth) {
            pvMapRef.current.set(idx, {
              scoreLabel,
              pv: message.pv,
              depth: d,
              mate,
              cp,
            });
            const rows: EnginePvRow[] = [];
            for (let r = 1; r <= multiPv; r++) {
              const row = pvMapRef.current.get(r);
              if (row) rows.push({ rank: r, scoreLabel: row.scoreLabel, pv: row.pv });
            }
            setPvRows(rows);
          }
        }
      }

      if (idx === 1 || multiPv === 1) {
        if (message.positionEvaluation) {
          setPositionEvaluation(
            ((chessGameRef.current.turn() === 'w' ? 1 : -1) * Number(message.positionEvaluation)) /
              100,
          );
        }
        if (message.possibleMate) setPossibleMate(message.possibleMate);
        if (message.depth) setDepth(message.depth);
        if (message.pv) setBestLine(message.pv);
      }

      if (message.uciMessage === 'readyok') setEngineReady(true);
    });

    return () => {
      engineInstance.terminate();
      engineRef.current = null;
    };
  }, [multiPv]);

  const findBestMove = useCallback(() => {
    if (!engineRef.current) return;
    if (chessGameRef.current.isGameOver() || chessGameRef.current.isDraw()) return;

    if (multiPv > 1) {
      pvMapRef.current = new Map();
      setPvRows([]);
    }
    engineRef.current.evaluatePosition(chessGameRef.current.fen(), 18, multiPv);
  }, [multiPv]);

  useEffect(() => {
    if (engineReady) {
      findBestMove();
    }
  }, [chessPosition, engineReady, findBestMove]);

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false;

      try {
        chessGameRef.current.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
        setPossibleMate('');
        setChessPosition(chessGameRef.current.fen());
        engineRef.current?.stop();
        setBestLine('');
        pvMapRef.current = new Map();
        setPvRows([]);

        if (chessGameRef.current.isGameOver() || chessGameRef.current.isDraw()) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const bestMove = bestLine?.split(' ')?.[0];

  const chessboardOptions = {
    arrows: bestMove
      ? [
          {
            startSquare: bestMove.substring(0, 2),
            endSquare: bestMove.substring(2, 4),
            color: 'rgb(255, 177, 0)',
          },
        ]
      : undefined,
    position: chessPosition,
    onPieceDrop,
    id: 'analysis-board',
    boardStyle: {
      borderRadius: '8px',
      boxShadow: '0 2px 14px rgba(0, 0, 0, 0.12)',
      border: '1px solid rgba(0, 0, 0, 0.12)',
    },
  };

  const setPositionFromFen = useCallback(
    (fen: string) => {
      try {
        new Chess(fen);
        chessGameRef.current.load(fen);
        setPossibleMate('');
        setChessPosition(chessGameRef.current.fen());
        engineRef.current?.stop();
        setBestLine('');
        pvMapRef.current = new Map();
        setPvRows([]);
      } catch (error) {
        console.warn('⚠️ Failed to set position from FEN:', fen.substring(0, 50), error);
      }
    },
    [],
  );

  return {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    bestMove,
    pvRows,
    onPieceDrop,
    chessboardOptions,
    applyExternalMove: useCallback((uciMove: string) => {
      try {
        chessGameRef.current.move(uciMove, { strict: false });
        setPossibleMate('');
        setChessPosition(chessGameRef.current.fen());
        engineRef.current?.stop();
        setBestLine('');
        pvMapRef.current = new Map();
        setPvRows([]);
      } catch {
        // ignore
      }
    }, []),
    setPositionFromFen,
  };
}
