'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { ChessVideoStreamWebRTC } from '@/components/shared';

type Props = {
  params: {
    token: string;
  };
};

export default function WatchGamePage({ params }: Props) {
  const searchParams = useSearchParams();
  // Читаем параметр viewer из URL (по умолчанию true для страницы просмотра)
  const viewerParam = searchParams.get('viewer');
  const viewer = viewerParam === null ? true : viewerParam === 'true';

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">
        {viewer ? 'Просмотр игры' : 'Стрим игры'}
      </h1>
      <ChessVideoStreamWebRTC gameToken={params.token} viewer={viewer} />
    </div>
  );
}
