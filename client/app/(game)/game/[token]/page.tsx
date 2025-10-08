'use client';

import React, { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { useRouter } from 'next/navigation';
import { ApiRoutes } from '@/services/routes';

type Move = string;

type GameData = {
  id: number;
  token: string;
  initialPosition: string;
  moves: Move[];
};

type Props = {
  params: {
    token: string;
  };
};

export default function GamePage({ params }: Props) {
  const router = useRouter();

  // const token = params.token;

  const [game, setGame] = useState<GameData | null>({
    id: 1,
    token: '123',
    initialPosition: 'startpos',
    moves: ['e2e4', 'e7e5'],
  });
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  // Рассчет FEN позиции для текущего хода (можно вычислять на бэке или через библиотеку chess.js)
  const [position, setPosition] = useState<string>('startpos');

  // useEffect(() => {
  //   if (!token) return;

  //   async function fetchGame() {
  //     const res = await fetch(`${ApiRoutes.GET_GAME}/${token}`);
  //     if (!res.ok) {
  //       alert('Игра не найдена');
  //       return;
  //     }
  //     const data: GameData = await res.json();
  //     setGame(data);
  //     setCurrentMoveIndex(data.moves.length);
  //   }

  //   fetchGame();
  // }, [token]);

  // useEffect(() => {
  //   if (!game) return;

  //   // Просто для примера: формируем position 'startpos' или применяем ходы для задачи
  //   // В реальном проекте лучше получать FEN с бэка для каждого хода
  //   if (currentMoveIndex === 0) {
  //     setPosition(game.initialPosition);
  //   } else {
  //     // Здесь можно интегрировать chess.js и играть ходы по массиву game.moves.slice(0, currentMoveIndex)
  //     // Сейчас просто фиктивно переключаемся, оставим как есть
  //     setPosition('startpos');
  //   }
  // }, [currentMoveIndex, game]);

  const onDelete = async () => {
    if (!game) return;
    if (!confirm('Удалить игру?')) return;

    const res = await fetch(`/api/game/${game.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      alert('Игра удалена');
      router.push('/');
    } else {
      alert('Ошибка при удалении');
    }
  };

  // if (!game) return <div>Загрузка...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Игра {game.token || '123'}</h1>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          onClick={onDelete}>
          Удалить игру
        </button>
      </header>

      <main className="flex flex-grow max-w-7xl mx-auto p-6 gap-6">
        <section className="flex-shrink-0">
          <Chessboard position={position} />
        </section>

        <aside className="flex-grow bg-white rounded shadow p-6 flex flex-col">
          <div className="mb-4">
            <button
              disabled={currentMoveIndex <= 0}
              onClick={() => setCurrentMoveIndex(currentMoveIndex - 1)}
              className="mr-2 px-3 py-1 bg-gray-300 rounded disabled:opacity-50">
              Назад
            </button>
            <button
              disabled={currentMoveIndex >= game.moves.length}
              onClick={() => setCurrentMoveIndex(currentMoveIndex + 1)}
              className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50">
              Вперёд
            </button>
          </div>

          <div className="overflow-auto border border-gray-300 rounded p-3 bg-gray-50 flex-grow">
            <h2 className="text-lg font-semibold mb-2">Ходы ({game.moves.length})</h2>
            <ul>
              {game.moves.map((move, i) => (
                <li key={i} className={i === currentMoveIndex - 1 ? 'font-bold' : ''}>
                  {i + 1}. {move}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
