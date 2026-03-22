import React from 'react';
import { Container } from './container';
import { Logo } from './logo';

const Footer = () => {
  return (
    <footer className="z-100 bg-background shadow backdrop-blur-sm dark:bg-background dark:text-primary dark:shadow-accent">
      <Container className="flex flex-col gap-4 py-4 max-md:items-stretch md:flex-row md:items-center md:justify-between">
        <Logo />
        <div className="flex flex-col gap-1 text-sm max-md:text-center md:text-right">
          <p>
            Поддержка:{' '}
            <a
              href="mailto:support@chesscast.com"
              className="text-blue-600 hover:underline dark:text-blue-400">
              support@chesscast.com
            </a>
          </p>
          <p>&copy; {new Date().getFullYear()} ChessCast. Все права защищены.</p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
