'use client';

import React, { useState } from 'react';
import { Container } from './container';
import Link from 'next/link';
import { Button } from '../ui/button';
import { ThemeToggle } from './theme-toggle';
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import { Logo } from './logo';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearUser = useUserStore((s) => s.clearUser);
  const loggedIn = Boolean(accessToken);

  const logout = () => {
    clearAuth();
    clearUser();
    setIsOpen(false);
  };

  const navClass =
    'text-foreground/80 hover:text-foreground transition-colors duration-100';

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <Container className="flex items-center justify-between py-4">
        <Logo />
        <div className="flex max-md:flex-row-reverse max-md:gap-2 items-center gap-6">
          <Button
            className="md:hidden !h-9 !min-h-9 !w-9 !min-w-9 !p-0 text-foreground focus:outline-none"
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Меню">
            {isOpen ? <X /> : <Menu />}
          </Button>

          <nav className="hidden items-center gap-6 md:flex">
            {loggedIn ? (
              <>
                <Link href="/dashboard" className={navClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutDashboard className="size-4" />
                    Дашборд
                  </span>
                </Link>
                <Button variant="ghost" onClick={logout} className="gap-1.5">
                  <LogOut className="size-4" />
                  Выйти
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className={navClass}>
                  Вход
                </Link>
                <Link href="/register" className={navClass}>
                  Регистрация
                </Link>
              </>
            )}
            {!loggedIn ? (
              <Link href="/pricing" className={navClass}>
                Цены
              </Link>
            ) : null}
          </nav>
          <ThemeToggle />
        </div>
      </Container>

      {isOpen && (
        <nav className="border-t border-border bg-background md:hidden">
          <Container className="flex flex-col space-y-3 py-4">
            {loggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={navClass}
                  onClick={() => setIsOpen(false)}>
                  Дашборд
                </Link>
                <button type="button" className={`text-left ${navClass}`} onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={navClass} onClick={() => setIsOpen(false)}>
                  Вход
                </Link>
                <Link href="/register" className={navClass} onClick={() => setIsOpen(false)}>
                  Регистрация
                </Link>
              </>
            )}
            {!loggedIn ? (
              <Link href="/pricing" className={navClass} onClick={() => setIsOpen(false)}>
                Цены
              </Link>
            ) : null}
          </Container>
        </nav>
      )}
    </header>
  );
};

export default Header;
