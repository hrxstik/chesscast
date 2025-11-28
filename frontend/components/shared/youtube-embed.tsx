import React from 'react';

interface Props {
  className?: string;
  videoId: string;
}

export const YouTubeEmbed: React.FC<Props> = ({ className, videoId }) => (
  <iframe
    src={`https://www.youtube.com/embed/${videoId}`}
    className={className}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
  />
);
