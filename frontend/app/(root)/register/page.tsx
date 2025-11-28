import { RegisterForm } from '@/components/shared/form/register-form';
import React from 'react';

type Props = {};

export default function RegisterPage({}: Props) {
  return (
    <div className="min-h-[90vh] flex items-center justify-center py-16">
      <RegisterForm />
    </div>
  );
}
