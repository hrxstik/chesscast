'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessboardOptions, defaultBoardStyle, PieceDropHandlerArgs } from 'react-chessboard';
import Engine, { EngineMessage } from '@/lib/services/engine';

interface UseEngineReturn {
  chessPosition: string;
  positionEvaluation: number;
  engineReady: boolean;
  depth: number;
  bestLine: string;
  possibleMate: string;
  bestMove: string | undefined;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
  chessboardOptions: ChessboardOptions;
}

export function useEngine(initialFen?: string): UseEngineReturn {
  const engineRef = useRef<Engine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const chessGameRef = useRef(new Chess(initialFen));
  const chessGame = chessGameRef.current;

  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [positionEvaluation, setPositionEvaluation] = useState(0);
  const [depth, setDepth] = useState(10);
  const [bestLine, setBestLine] = useState('');
  const [possibleMate, setPossibleMate] = useState('');

  useEffect(() => {
    const engineInstance = new Engine();
    engineRef.current = engineInstance;

    engineInstance.onMessage((message: EngineMessage) => {
      if (message.depth && message.depth < 10) return;

      if (message.positionEvaluation) {
        setPositionEvaluation(
          ((chessGameRef.current.turn() === 'w' ? 1 : -1) * Number(message.positionEvaluation)) /
            100,
        );
      }
      if (message.possibleMate) setPossibleMate(message.possibleMate);
      if (message.depth) setDepth(message.depth);
      if (message.pv) setBestLine(message.pv);
      if (message.uciMessage === 'readyok') setEngineReady(true);
    });

    return () => {
      engineInstance.terminate();
      engineRef.current = null;
    };
  }, []);

  const findBestMove = useCallback(() => {
    if (!engineRef.current) return;
    if (chessGameRef.current.isGameOver() || chessGameRef.current.isDraw()) return;

    engineRef.current.evaluatePosition(chessGameRef.current.fen(), 18);
  }, []);

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
      borderRadius: '10px',
      boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.5)',
      border: '1px solid #000',
      margin: '20px 0',
      width: '50%',
    },
  };

  return {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    bestMove,
    onPieceDrop,
    chessboardOptions,
  };
}
