import { Title } from '@/components/shared/title';
import { YouTubeEmbed } from '@/components/shared/youtube-embed';
import Link from 'next/link';
import React from 'react';

type Props = {};

export default function RootPage({}: Props) {
  return (
    <div className="py-16 flex flex-col items-center text-center gap-8">
      <Title
        className="font-extrabold leading-tight"
        text={
          'Добро пожаловать в ChessCast — платформу для анализа физических шахматных партий в реальном времени'
        }
        size="xl"
      />
      <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mb-16">
        Улучшайте свои навыки в шахматах с помощью анализа партий в реальном времени. Наш сервис
        подходит как новичкам, так и профессионалам. ChessCast можно использовать как в личных
        целях, так и для игры в шахматной организации или на турнирах.
      </p>

      <Title className="font-extrabold leading-tight" text={'Как работает ChessCast?'} size="lg" />
      <YouTubeEmbed
        videoId="dQw4w9WgXcQ"
        className="aspect-video w-full max-w-3xl rounded-lg shadow-lg"
      />

      <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl">
        Для анализа партии в реальном времени используется интеллектуальная система, которая
        использует компьютерное зрение, чтобы анализировать доску и предсказывать ходы. Для работы
        нашего сервиса, вам необходимо иметь штатив и телефон, чтобы записывать партии в реальном
        времени.
      </p>

      <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl">
        Запись в камеры телефона передается на сервер, где искусственный интеллект определяет
        текущее положение игры, и, используя шахматный движок Stockfish 17.1, оценивает позицию
        игроков и предсказывает ходы.
      </p>

      <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mb-16">
        Помимо анализа в реальном времени вы можете использовать ChessCast для игры в личных целях,
        чтобы улучшить свои навыки в шахматах, так как вы можете просматривать оцифрованные партии в
        своей истории игр, своей шахматной организации или истории игр других игроков.
      </p>

      <Title className="font-extrabold leading-tight" text={'Турниры'} size="lg" />
      <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mb-16">
        Организации могут проводить турниры, записывая сразу несколько игр одновременно. ChessCast
        позволяет следить за несколькими играми сразу. Ваша шахматная организация может использовать
        ChessCast на турнирах вместо использования электронных шахматных досок.
      </p>

      <Title className="font-extrabold leading-tight" text={'Начать играть'} size="lg" />
      <p className="text-gray-700 dark:text-gray-300 max-w-3xl">
        Присоединяйтесь к нашему сообществу, изучайте стратегии, анализируйте свои игры, следите за
        новыми турнирами и совершенствуйте мастерство с помощью ведущих шахматных технологий.
      </p>

      <Link
        href="/register"
        className="mt-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
        Зарегистрироваться и начать играть
      </Link>
    </div>
  );
}
