import { LoginForm } from '@/components/shared/form/login-form';
import React from 'react';

type Props = {};

export default function LoginPage({}: Props) {
  return (
    <div className="min-h-[90vh] flex items-center justify-center py-16">
      <LoginForm />
    </div>
  );
}
