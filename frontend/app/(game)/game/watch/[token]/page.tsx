'use client';

import React from 'react';
import { ChessVideoStreamWebRTC } from '@/components/shared';

type Props = {
  params: {
    token: string;
  };
};

export default function WatchGamePage({ params }: Props) {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Просмотр игры</h1>
      <ChessVideoStreamWebRTC gameToken={params.token} />
    </div>
  );
}
