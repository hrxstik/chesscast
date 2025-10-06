'use client';

import React, { useState } from 'react';
import { Container } from './container';
import Link from 'next/link';
import { Button } from '../ui/button';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow sticky top-0 z-100">
      <Container className="flex items-center justify-between py-4">
        {/* Логотип */}
        <Link href="/" className="flex items-center space-x-2">
          <img src="/logo.png" alt="ChessCast Logo" className="h-8 w-8 rounded-full" />
          <span className="font-bold text-xl text-gray-800">ChessCast</span>
        </Link>

        {/* Кнопка бургер для мобильных */}
        <Button
          className="md:hidden text-gray-700 focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </Button>

        {/* Навигация - скрыта на мобилках */}
        <nav className="hidden md:flex space-x-6">
          <Link href="/login" className="text-gray-700 hover:text-blue-600">
            Вход
          </Link>
          <Link href="/register" className="text-gray-700 hover:text-blue-600">
            Регистрация
          </Link>
          <Link href="/pricing" className="text-gray-700 hover:text-blue-600">
            Цены на подписки
          </Link>
        </nav>
      </Container>

      {/* Меню для мобильных */}
      {isOpen && (
        <nav className="md:hidden bg-white shadow-md">
          <Container className="flex flex-col space-y-3 py-4">
            <Link
              href="/login"
              className="text-gray-700 hover:text-blue-600"
              onClick={() => setIsOpen(false)}>
              Вход
            </Link>
            <Link
              href="/register"
              className="text-gray-700 hover:text-blue-600"
              onClick={() => setIsOpen(false)}>
              Регистрация
            </Link>
            <Link
              href="/pricing"
              className="text-gray-700 hover:text-blue-600"
              onClick={() => setIsOpen(false)}>
              Цены на подписки
            </Link>
          </Container>
        </nav>
      )}
    </header>
  );
};

export default Header;
