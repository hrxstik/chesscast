'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FormInput } from './form-input';
import { LoginFormValues, loginSchema } from './schemas';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { loginRequest } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';
import { ApiError } from '@/lib/api/types';
import { safeNextPath } from '@/lib/navigation';

interface Props {
  onClose?: () => void;
}

export const LoginForm: React.FC<Props> = ({ onClose }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useUserStore((s) => s.setUser);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);
      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        platformRole: data.user.platformRole,
      });
      toast.success('Вы успешно вошли в аккаунт', { icon: '✅' });
      onClose?.();
      router.push(safeNextPath(searchParams.get('next')));
    },
    onError: (error) => {
      const msg =
        error instanceof ApiError ? error.message : 'Не удалось войти в аккаунт';
      toast.error(msg, { icon: '❌' });
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    mutation.mutate(data);
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
          loading={form.formState.isSubmitting || mutation.isPending}
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
