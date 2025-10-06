import { cn } from '@/lib/utils';
import React from 'react';

interface Props {
  className?: string;
}

export const Container: React.FC<React.PropsWithChildren<Props>> = ({ className, children }) => {
  return (
    <div className={cn('mx-auto max-w-[1280px] max-[1400px]:px-30 max-[480px]:px-10', className)}>
      {children}
    </div>
  );
};
