'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import React, { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme, systemTheme } = useTheme();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="w-6 h-6 rounded-full" />;
  }
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Переключить тему"
      className="relative w-8 h-8">
      <Sun
        className={`cursor-pointer absolute top-0 left-0 right-0 bottom-0 m-auto transition-all duration-200 ease-in-out ${
          isDark ? 'scale-0 rotate-90' : 'scale-100 rotate-0'
        } stroke-amber-400 fill-amber-400 hover:stroke-neutral-400 hover:fill-neutral-400`}
      />

      <Moon
        className={`cursor-pointer absolute top-0 left-0 right-0 bottom-0 m-auto transition-all duration-200 ease-in-out ${
          isDark ? 'scale-100 rotate-0' : 'scale-0 -rotate-90'
        } stroke-neutral-400 fill-neutral-400 hover:stroke-amber-400 hover:fill-amber-400`}
      />
    </button>
  );
};
