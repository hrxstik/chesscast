import React from 'react';

interface Props {
  className?: string;
}

export const CreateGamePage: React.FC<Props> = ({ className }) => {
  return (
    <div className={className}>
      <h1>Create Game</h1>
    </div>
  );
};
