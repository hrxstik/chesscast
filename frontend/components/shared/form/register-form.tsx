'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RegisterFormValues, registerSchema } from './schemas';
import { toast } from 'react-hot-toast';
import { FormInput } from './form-input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
import { ApiError } from '@/lib/api/types';
import { safeNextPath } from '@/lib/navigation';

interface Props {
  onClose?: () => void;
}

export const RegisterForm: React.FC<Props> = ({ onClose }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      passwordRepeat: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await register(data);
      toast.success('Аккаунт создан', { icon: '✅' });
      onClose?.();
      router.push(safeNextPath(searchParams.get('next')));
    } catch (error) {
      const msg =
        error instanceof ApiError ? error.message : 'Не удалось создать аккаунт';
      toast.error(msg, { icon: '❌' });
    }
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
          loading={form.formState.isSubmitting || isLoading}
          className="w-full">
          Зарегистрироваться
        </Button>

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
