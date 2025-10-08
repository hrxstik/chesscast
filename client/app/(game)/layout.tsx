import React from 'react';

type Props = {
  children: React.ReactNode;
};

export default function GameLayout({ children }: Props) {
  return <div>{children}</div>;
}
