'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { ChessVideoStreamWebRTC } from '@/components/shared';
import { H1, Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function WatchGamePage({ params }: Props) {
  const resolvedParams = React.use(params);
  const searchParams = useSearchParams();
  const viewerParam = searchParams.get('viewer');
  const viewer = viewerParam === null ? true : viewerParam === 'true';

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <H1 className="!text-xl md:!text-2xl">{viewer ? 'Просмотр игры' : 'Стрим игры'}</H1>
          <Text className="!mt-1 !mb-0 font-mono text-xs text-muted-foreground">
            token: {resolvedParams.token.slice(0, 16)}…
          </Text>
        </div>
        <Badge variant={viewer ? 'secondary' : 'default'}>
          {viewer ? 'Режим зрителя' : 'Ведущий стрим'}
        </Badge>
      </div>

      <ChessVideoStreamWebRTC gameToken={resolvedParams.token} viewer={viewer} />
    </div>
  );
}
