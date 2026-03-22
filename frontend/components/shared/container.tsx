import { cn } from '@/lib/utils';
import { CONTENT_MAX_WIDTH_CLASS } from '@/lib/layout-classes';
import React from 'react';

interface Props {
  className?: string;
}

export const Container: React.FC<React.PropsWithChildren<Props>> = ({ className, children }) => {
  return <div className={cn(CONTENT_MAX_WIDTH_CLASS, className)}>{children}</div>;
};
