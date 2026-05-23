'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { ChessboardOptions } from 'react-chessboard';
import Engine, { EngineMessage } from '@/lib/services/engine';
import { formatPvLineUciToSan } from '@/lib/chess/format-pv-line';
import { barEvalForFen, isTerminalChessPosition } from '@/lib/chess/terminal-eval';

export type EnginePvRow = {
  rank: number;
  scoreLabel: string;
  pv: string;
};

type PieceDropArgs = {
  sourceSquare: string;
  targetSquare: string;
};

type UseEngineOptions = {
  /** Stockfish MultiPV (1 = только первая линия) */
  multiPv?: number;
  /** Разрешить перетаскивание фигур (режим анализа). */
  allowMove?: boolean;
  onFenChange?: (fen: string) => void;
};

type EvalSnapshot = {
  kind: 'cp' | 'mate';
  depth: number;
  cpWhite: number;
  mateWhite: number | null;
  pvUci: string;
};

interface UseEngineReturn {
  chessPosition: string;
  isTerminalPosition: boolean;
  positionEvaluation: number;
  evaluationCpWhite: number;
  mateWhite: number | null;
  engineReady: boolean;
  depth: number;
  bestLine: string;
  possibleMate: string;
  bestMove: string | undefined;
  pvRows: EnginePvRow[];
  onPieceDrop: (args: PieceDropArgs) => boolean;
  chessboardOptions: ChessboardOptions;
  applyExternalMove: (uciMove: string) => void;
  setPositionFromFen: (fen: string) => void;
}

function applySnapshotToState(
  snap: EvalSnapshot,
  setters: {
    setEvaluationCpWhite: (v: number) => void;
    setPositionEvaluation: (v: number) => void;
    setMateWhite: (v: number | null) => void;
    setPossibleMate: (v: string) => void;
    setBestLine: (v: string) => void;
    fen: string;
  },
) {
  if (isTerminalChessPosition(setters.fen)) {
    setters.setMateWhite(null);
    setters.setPossibleMate('');
    setters.setEvaluationCpWhite(0);
    setters.setPositionEvaluation(0);
  } else if (snap.kind === 'mate' && snap.mateWhite != null && snap.mateWhite !== 0) {
    setters.setMateWhite(snap.mateWhite);
    setters.setPossibleMate(
      snap.mateWhite > 0 ? `+M${snap.mateWhite}` : `-M${Math.abs(snap.mateWhite)}`,
    );
    setters.setEvaluationCpWhite(0);
    setters.setPositionEvaluation(0);
  } else {
    setters.setMateWhite(null);
    setters.setPossibleMate('');
    setters.setEvaluationCpWhite(snap.cpWhite);
    setters.setPositionEvaluation(snap.cpWhite / 100);
  }
  setters.setBestLine(formatPvLineUciToSan(setters.fen, snap.pvUci));
}

export function useEngine(initialFen?: string, opts?: UseEngineOptions): UseEngineReturn {
  const multiPv = opts?.multiPv ?? 1;
  const allowMove = opts?.allowMove ?? false;
  const onFenChange = opts?.onFenChange;
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
  const [evaluationCpWhite, setEvaluationCpWhite] = useState(0);
  const [mateWhite, setMateWhite] = useState<number | null>(null);
  const [depth, setDepth] = useState(10);
  const [bestLine, setBestLine] = useState('');
  const [possibleMate, setPossibleMate] = useState('');
  const [pvRows, setPvRows] = useState<EnginePvRow[]>([]);
  const [bestMoveArrow, setBestMoveArrow] = useState<string | undefined>();

  const analysisFenRef = useRef(chessGameRef.current.fen());
  const evalSessionRef = useRef(0);
  const lastEvalSessionRef = useRef(0);
  const primaryEvalRef = useRef<EvalSnapshot | null>(null);
  const pvMapRef = useRef<
    Map<number, { scoreLabel: string; pv: string; depth: number; kind: 'cp' | 'mate' }>
  >(new Map());

  /** Новый расчёт: линии/стрелку сбрасываем, шкалу оставляем до следующего info. */
  const prepareNewSearch = useCallback((fen: string) => {
    primaryEvalRef.current = null;
    pvMapRef.current = new Map();
    setPvRows([]);
    setBestLine('');
    setPossibleMate('');
    setBestMoveArrow(undefined);
    analysisFenRef.current = fen;
  }, []);

  const syncArrowFromSnap = useCallback((pvUci: string) => {
    const uci = pvUci.split(/\s+/)?.[0];
    if (uci && uci.length >= 4) setBestMoveArrow(uci);
    else setBestMoveArrow(undefined);
  }, []);

  useEffect(() => {
    const engineInstance = new Engine();
    engineRef.current = engineInstance;

    engineInstance.onMessage((message: EngineMessage) => {
      if (message.uciMessage === 'readyok') {
        setEngineReady(true);
        return;
      }

      if (evalSessionRef.current !== lastEvalSessionRef.current) return;

      const fen = analysisFenRef.current;
      if (chessGameRef.current.fen() !== fen) return;
      if (isTerminalChessPosition(fen)) return;

      if (message.bestMove !== undefined) {
        return;
      }

      const msgDepth = message.depth ?? 0;
      const minCpDepth = 8;
      const minMateDepth = 6;
      const hasMate =
        message.possibleMate !== undefined && message.possibleMate !== '';
      const hasCp =
        message.positionEvaluation !== undefined && message.positionEvaluation !== '';
      if (!hasMate && hasCp && msgDepth > 0 && msgDepth < minCpDepth) return;

      const idx = message.multipv ?? 1;
      const turn = chessGameRef.current.turn();
      const parseMateWhite = (mateStm: number) => (turn === 'w' ? mateStm : -mateStm);
      const parseCpWhite = (cpStm: number) => (turn === 'w' ? cpStm : -cpStm);

      if (multiPv > 1 && message.pv && (hasMate || hasCp)) {
        let scoreLabel = '…';
        if (hasMate && msgDepth >= minMateDepth) {
          const mWhite = parseMateWhite(Number(message.possibleMate));
          if (mWhite === 0) return;
          scoreLabel = mWhite > 0 ? `+M${mWhite}` : `-M${Math.abs(mWhite)}`;
        } else if (hasCp && msgDepth >= minCpDepth) {
          const cpW = parseCpWhite(Number(message.positionEvaluation));
          const signed = cpW / 100;
          scoreLabel = signed >= 0 ? `+${signed.toFixed(2)}` : signed.toFixed(2);
        } else {
          return;
        }

        const prev = pvMapRef.current.get(idx);
        if (!prev || msgDepth >= prev.depth) {
          pvMapRef.current.set(idx, {
            scoreLabel,
            pv: formatPvLineUciToSan(fen, message.pv),
            depth: msgDepth,
            kind: hasMate ? 'mate' : 'cp',
          });
          const rows: EnginePvRow[] = [];
          for (let r = 1; r <= multiPv; r++) {
            const row = pvMapRef.current.get(r);
            if (row && row.scoreLabel !== '…') {
              rows.push({ rank: r, scoreLabel: row.scoreLabel, pv: row.pv });
            }
          }
          setPvRows(rows);
        }
      }

      if (idx !== 1 && multiPv > 1) return;

      let incoming: EvalSnapshot | null = null;
      if (hasMate && msgDepth >= minMateDepth) {
        const mWhite = parseMateWhite(Number(message.possibleMate));
        if (mWhite !== 0) {
          incoming = {
            kind: 'mate',
            depth: msgDepth,
            cpWhite: 0,
            mateWhite: mWhite,
            pvUci: message.pv ?? '',
          };
        }
      } else if (hasCp && msgDepth >= minCpDepth) {
        incoming = {
          kind: 'cp',
          depth: msgDepth,
          cpWhite: parseCpWhite(Number(message.positionEvaluation)),
          mateWhite: null,
          pvUci: message.pv ?? '',
        };
      }

      if (!incoming) {
        if (msgDepth) setDepth(msgDepth);
        return;
      }

      const prev = primaryEvalRef.current;
      const replace =
        !prev ||
        (incoming.kind === 'mate'
          ? prev.kind !== 'mate' || msgDepth >= prev.depth
          : prev.kind !== 'mate' && msgDepth >= prev.depth);

      if (replace && evalSessionRef.current === lastEvalSessionRef.current) {
        primaryEvalRef.current = incoming;
        applySnapshotToState(incoming, {
          setEvaluationCpWhite,
          setPositionEvaluation,
          setMateWhite,
          setPossibleMate,
          setBestLine,
          fen,
        });
        syncArrowFromSnap(incoming.pvUci);
      }

      if (msgDepth) setDepth(msgDepth);
    });

    return () => {
      engineInstance.terminate();
      engineRef.current = null;
    };
  }, [multiPv, syncArrowFromSnap]);

  const runAnalysis = useCallback(() => {
    if (!engineRef.current) return;

    evalSessionRef.current += 1;
    lastEvalSessionRef.current = evalSessionRef.current;

    const fen = chessGameRef.current.fen();
    prepareNewSearch(fen);

    if (isTerminalChessPosition(fen)) {
      const bar = barEvalForFen(fen);
      setMateWhite(bar.mateWhite);
      setEvaluationCpWhite(bar.cpWhite);
      setPositionEvaluation(0);
      setPossibleMate('');
      setBestMoveArrow(undefined);
      return;
    }

    /** Ограниченный поиск: ~500 ms на позицию (go movetime), не бесконечная глубина. */
    engineRef.current.evaluatePosition(fen, { movetimeMs: 500, multiPv });
  }, [multiPv, prepareNewSearch]);

  const findBestMove = runAnalysis;

  const findBestMoveRef = useRef(findBestMove);
  findBestMoveRef.current = findBestMove;

  useEffect(() => {
    if (engineReady) {
      findBestMove();
    }
  }, [chessPosition, engineReady, findBestMove]);

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropArgs) => {
      if (!allowMove) return false;
      try {
        const move = chessGameRef.current.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q',
        });
        if (!move) return false;
        const fen = chessGameRef.current.fen();
        evalSessionRef.current += 1;
        engineRef.current?.stop();
        prepareNewSearch(fen);
        setChessPosition(fen);
        onFenChange?.(fen);
        queueMicrotask(() => findBestMoveRef.current());
        return true;
      } catch {
        return false;
      }
    },
    [allowMove, onFenChange, prepareNewSearch],
  );

  const chessboardOptions = {
    arrows: bestMoveArrow
      ? [
          {
            startSquare: bestMoveArrow.substring(0, 2),
            endSquare: bestMoveArrow.substring(2, 4),
            color: 'rgb(255, 177, 0)',
          },
        ]
      : undefined,
    position: chessPosition,
    allowDragging: allowMove,
    allowDrawingArrows: false,
    canDragPiece: () => allowMove,
    onPieceDrop,
    id: 'analysis-board',
    showAnimations: true,
    animationDurationInMs: 120,
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
        evalSessionRef.current += 1;
        engineRef.current?.stop();
        const loaded = chessGameRef.current.fen();
        prepareNewSearch(loaded);
        setChessPosition(loaded);
        queueMicrotask(() => {
          if (engineRef.current) findBestMoveRef.current();
        });
      } catch (error) {
        console.warn('⚠️ Failed to set position from FEN:', fen.substring(0, 50), error);
      }
    },
    [prepareNewSearch],
  );

  return {
    chessPosition,
    isTerminalPosition: isTerminalChessPosition(chessPosition),
    positionEvaluation,
    evaluationCpWhite,
    mateWhite,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    bestMove: bestMoveArrow,
    pvRows,
    onPieceDrop,
    chessboardOptions,
    applyExternalMove: useCallback((uciMove: string) => {
      try {
        chessGameRef.current.move(uciMove, { strict: false });
        evalSessionRef.current += 1;
        engineRef.current?.stop();
        prepareNewSearch(chessGameRef.current.fen());
        setChessPosition(chessGameRef.current.fen());
      } catch {
        // ignore
      }
    }, [prepareNewSearch]),
    setPositionFromFen,
  };
}
