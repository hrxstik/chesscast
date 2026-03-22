'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { RegisterFormValues, registerSchema } from './schemas';
import { toast } from 'react-hot-toast';
import { FormInput } from './form-input';
import { Button } from '@/components/ui/button';
import { GoogleButton } from '../google-button';
import { registerRequest } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user';
import { ApiError } from '@/lib/api/types';
import { safeNextPath } from '@/lib/navigation';

interface Props {
  onClose?: () => void;
}

export const RegisterForm: React.FC<Props> = ({ onClose }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useUserStore((s) => s.setUser);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordRepeat: '',
    },
  });

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        platformRole: data.user.platformRole,
      });
      toast.success('Аккаунт создан', { icon: '✅' });
      onClose?.();
      router.push(safeNextPath(searchParams.get('next')));
    },
    onError: (error) => {
      const msg =
        error instanceof ApiError ? error.message : 'Не удалось создать аккаунт';
      toast.error(msg, { icon: '❌' });
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    mutation.mutate(data);
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-card w-full max-w-md space-y-4 rounded-xl border border-border p-6 shadow-sm">
        <FormInput name="name" label="Имя пользователя" required />
        <FormInput name="email" label="Email" type="email" required />
        <FormInput name="password" label="Пароль" type="password" required />
        <FormInput name="passwordRepeat" label="Повторите пароль" type="password" required />

        <Button
          type="submit"
          loading={form.formState.isSubmitting || mutation.isPending}
          className="w-full">
          Зарегистрироваться
        </Button>

        <GoogleButton />

        <p className="mt-6 text-center text-sm">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
            Войдите
          </Link>
        </p>
      </form>
    </FormProvider>
  );
};
