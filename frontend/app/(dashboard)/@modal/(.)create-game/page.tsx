import React from 'react';

interface Props {
  className?: string;
}

export default function CreateGamePage({ className }: Props) {
  return (
    <div className={className}>
      <h1>Create Game</h1>
    </div>
  );
}
