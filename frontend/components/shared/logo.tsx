import Link from 'next/link';
import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

export const Logo: React.FC<Props> = ({ className }) => {
  return (
    <Link href="/" className={cn('group flex items-center space-x-2', className)}>
      <img src="/logo.png" alt="ChessCast Logo" className="h-8 w-8 rounded-full" />
      <span className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100 font-bold text-xl">
        ChessCast
      </span>
    </Link>
  );
};
