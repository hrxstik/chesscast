'use client';

import React from 'react';
import { Chessboard } from 'react-chessboard';
import { useEngine } from '@/lib/hooks/useEngine';

type Move = string;

type GameData = {
  id: number;
  token: string;
  moves: Move[];
};

type Props = {
  params: {
    token: string;
  };
};

export default function GamePage({ params }: Props) {
  const {
    chessPosition,
    positionEvaluation,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
  } = useEngine();

  return (
    <div>
      <div>
        Engine: {engineReady ? 'Ready' : 'Loading...'} | Evaluation:{' '}
        {possibleMate ? `#${possibleMate}` : positionEvaluation} | Depth: {depth}
      </div>
      <div>
        Best line: <i>{bestLine.slice(0, 40)}</i> ...
      </div>

      <Chessboard options={chessboardOptions} />

      <p
        style={{
          fontSize: '0.8rem',
          color: '#666',
        }}>
        Make moves on the board to analyze positions. The green arrow shows Stockfish&apos;s
        suggested best move. The evaluation is shown in centipawns (positive numbers favor White,
        negative favor Black).
      </p>
    </div>
  );
}
