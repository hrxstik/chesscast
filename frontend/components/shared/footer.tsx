import React, { useState } from 'react';
import { Container } from './container';
import Link from 'next/link';
import { Logo } from './logo';

const Footer = () => {
  return (
    <footer className="dark:bg-background bg-background dark:text-primary dark:shadow-accent shadow z-100 backdrop-blur-sm">
      <Container className="flex items-center justify-between py-4 max-lg:flex-col gap-4">
        <Logo />
        <p className="text-sm">
          Поддержка:{' '}
          <a
            href="mailto:support@chesscast.com"
            className="text-blue-600 hover:underline dark:text-blue-400">
            support@chesscast.com
          </a>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} ChessCast. Все права защищены.
          </p>
        </p>
      </Container>
    </footer>
  );
};

export default Footer;
