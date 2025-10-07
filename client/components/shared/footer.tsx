import React, { useState } from 'react';
import { Container } from './container';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="dark:bg-background bg-background dark:text-primary dark:shadow-accent shadow z-100 backdrop-blur-sm">
      <Container className="flex items-center justify-between py-4 max-lg:flex-col gap-4">
        <Link href="/" className="flex items-center space-x-2 group">
          <img src="/logo.png" alt="ChessCast Logo" className="h-8 w-8 rounded-full" />
          <span className="dark:text-primary text-primary hover:text-accent-foreground dark:hover:text-accent-foreground duration-100 font-bold text-xl">
            ChessCast
          </span>
        </Link>

        <p className="text-sm">&copy; {new Date().getFullYear()} ChessCast. Все права защищены.</p>
        <p className="text-sm">
          Поддержка:{' '}
          <a
            href="mailto:support@chesscast.com"
            className="text-blue-600 hover:underline dark:text-blue-400">
            support@chesscast.com
          </a>
        </p>
      </Container>
    </footer>
  );
};

export default Footer;
