import { apiFetch } from './client';
import type { LoginResponse } from './types';

export type LoginBody = { email: string; password: string };

export type RegisterBody = {
  name: string;
  email: string;
  password: string;
  passwordRepeat: string;
};

export async function loginRequest(body: LoginBody): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
    skipAuth: true,
  });
}

export async function registerRequest(
  body: RegisterBody,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/register', {
    method: 'POST',
    body,
    skipAuth: true,
  });
}
