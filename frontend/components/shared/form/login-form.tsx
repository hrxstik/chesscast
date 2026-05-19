'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormInput } from './form-input';
import { LoginFormValues, loginSchema } from './schemas';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/types';
import { safeNextPath } from '@/lib/navigation';

interface Props {
  onClose?: () => void;
}

export const LoginForm: React.FC<Props> = ({ onClose }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data);
      toast.success('Вы успешно вошли в аккаунт', { icon: '✅' });
      onClose?.();
      router.push(safeNextPath(searchParams.get('next')));
    } catch (error) {
      const msg =
        error instanceof ApiError ? error.message : 'Не удалось войти в аккаунт';
      toast.error(msg, { icon: '❌' });
    }
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-card w-full max-w-md space-y-4 rounded-xl border border-border p-6 shadow-sm">
        <FormInput name="email" label="Email" type="email" required />
        <FormInput name="password" label="Пароль" type="password" required />

        <Button
          type="submit"
          loading={form.formState.isSubmitting || isLoading}
          className="w-full">
          Войти
        </Button>

        <p className="mt-6 text-center text-sm">
          Нет аккаунта?{' '}
          <Link href="/register" className="text-primary font-medium underline-offset-4 hover:underline">
            Зарегистрируйтесь
          </Link>
        </p>
      </form>
    </FormProvider>
  );
};
