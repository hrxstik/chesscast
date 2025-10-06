import { Container } from '@/components/shared/container';
import { YouTubeEmbed } from '@/components/shared/youtube-embed';
import React from 'react';

type Props = {};

export default function RootPage({}: Props) {
  return (
    <>
      <YouTubeEmbed videoId="dQw4w9WgXcQ" className="aspect-video" />
    </>
  );
}
