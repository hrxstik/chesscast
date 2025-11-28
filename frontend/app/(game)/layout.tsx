import { Container } from '@/components/shared/container';
import React from 'react';

type Props = {
  children: React.ReactNode;
};

export default function GameLayout({ children }: Props) {
  return <Container>{children}</Container>;
}
