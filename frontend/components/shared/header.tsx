'use client';

import React, { useState } from 'react';
import { Container } from './container';
import Link from 'next/link';
import { Button } from '../ui/button';
import { ThemeToggle } from './theme-toggle';
import { Menu, X } from 'lucide-react';
import { Logo } from './logo';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="dark:bg-background/10 dark:text-primary dark:shadow-accent shadow sticky top-0 z-100 backdrop-blur-sm bg-white/10">
      <Container className="flex items-center justify-between py-4">
        <Logo />
        <div className="flex  max-md:flex-row-reverse max-md:gap-2 items-center gap-6">
          {/* Кнопка бургер для мобильных */}
          <Button
            className="md:hidden text-primary-foreground focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu">
            {isOpen ? <X /> : <Menu />}
          </Button>

          <nav className="hidden md:flex gap-6 items-center">
            <Link
              href="/login"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100">
              Вход
            </Link>
            <Link
              href="/register"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100">
              Регистрация
            </Link>
            <Link
              href="/pricing"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground !duration-100">
              Цены
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </Container>

      {/* Меню для мобильных */}
      {isOpen && (
        <nav className="md:hidden shadow-md dark:bg-background dark:text-primary">
          <Container className="flex flex-col space-y-3 py-4">
            <Link
              href="/login"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100"
              onClick={() => setIsOpen(false)}>
              Вход
            </Link>
            <Link
              href="/register"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100"
              onClick={() => setIsOpen(false)}>
              Регистрация
            </Link>
            <Link
              href="/pricing"
              className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100"
              onClick={() => setIsOpen(false)}>
              Цены
            </Link>
          </Container>
        </nav>
      )}
    </header>
  );
};

export default Header;
