'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { RegisterFormValues, registerSchema } from './schemas';
import { toast } from 'react-hot-toast';
import { FormInput } from './form-input';
import { Button } from '@/components/ui/button';

interface Props {
  onClose?: () => void;
}

export const RegisterForm: React.FC<Props> = ({ onClose }) => {
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      //TODO
      const res = await fetch(`${process.env.NEXT_PUBLIC_NEST_API_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to register');
      }

      toast.success('Вы успешно вошли в аккаунт', {
        icon: '✅',
      });

      onClose?.();
    } catch (error) {
      console.error('Error [REGISTER]', error);
      toast.error('Не удалось создать аккаунт', {
        icon: '❌',
      });
    }
  };

  React.useEffect(() => {
    console.log(process.env.NEXT_PUBLIC_NEST_API_URL);
  }, []);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="p-6 space-y-4 rounded shadow bg-card w-1/3 max-lg:w-full">
        <FormInput name="name" label="Имя пользователя" required />
        <FormInput name="email" label="Email" type="email" required />
        <FormInput name="password" label="Пароль" type="password" required />
        <FormInput name="passwordRepeat" label="Повторите пароль" type="password" required />

        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded">
          Зарегистрироваться
        </Button>

        <Link
          href="/api/auth/google"
          className="w-full block text-center mt-3 py-2 border border-gray-400 rounded hover:bg-gray-100">
          Войти через Google
        </Link>

        <p className="text-sm text-center mt-6">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-green-600 hover:underline">
            Войдите
          </Link>
        </p>
      </form>
    </FormProvider>
  );
};
