import * as z from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'Неверный email' }),
  password: z.string().min(6, 'Минимум 6 символов'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(3, 'Минимум 3 символа'),
    email: z.string().email({ message: 'Неверный email' }),
    password: z.string().min(6, 'Минимум 6 символов'),
    passwordRepeat: z.string().min(6, 'Минимум 6 символов'),
  })
  .refine((data) => data.password === data.passwordRepeat, {
    message: 'Пароли должны совпадать',
    path: ['passwordRepeat'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
