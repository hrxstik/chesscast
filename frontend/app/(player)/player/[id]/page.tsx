'use client';

import { useParams } from 'next/navigation';
import { Container } from '@/components/shared/container';
import { Title } from '@/components/shared/title';
import { useUserStore } from '@/store/user';
import React from 'react';

type Props = {};

export default function PlayerPage({}: Props) {
  const params = useParams();
  const userIdFromUrl = params.id;
  const user = useUserStore((state) => state.user);

  const isOwner = user?.id.toString() === userIdFromUrl;

  return (
    <div>
      <Container>
        <Title text={isOwner ? 'Ваш профиль' : `Профиль игрока ${userIdFromUrl}`} />
      </Container>
    </div>
  );
}
