import React from 'react';

interface Props {
  code: string;
}

export const VerificationUserTemplate: React.FC<Props> = ({ code }) => (
  <div>
    <h1>Подтверждение учетной записи ChessCast</h1>
    <p>
      Код подтверждения: <h2>{code}</h2>
    </p>

    <p>
      <a href={`${process.env.NEST_URL}/auth/verify?code=${code}`}>Подтвердить регистрацию</a>
    </p>
  </div>
);
