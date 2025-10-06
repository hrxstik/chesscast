'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { FormInput } from './form-input';
import { LoginFormValues, loginSchema } from './schemas';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

interface Props {
  onClose?: () => void;
}

export const LoginForm: React.FC<Props> = ({ onClose }) => {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      //TODO
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to login');
      }

      toast.success('Вы успешно вошли в аккаунт', {
        icon: '✅',
      });

      onClose?.();
    } catch (error) {
      console.error('Error [LOGIN]', error);
      toast.error('Не удалось войти в аккаунт', {
        icon: '❌',
      });
    }
  };
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="p-6 space-y-4 bg-white rounded shadow">
        <FormInput name="email" label="Email" type="email" required />
        <FormInput name="password" label="Пароль" type="password" required />

        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded">
          Войти
        </Button>

        <Link
          href="/api/auth/google"
          className="w-full block text-center mt-3 py-2 border border-gray-400 rounded hover:bg-gray-100">
          Войти через Google
        </Link>

        <p className="text-sm text-center mt-6">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Зарегистрируйтесь
          </Link>
        </p>
      </form>
    </FormProvider>
  );
};
