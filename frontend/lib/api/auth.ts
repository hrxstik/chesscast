import { apiFetch } from './client';
import type { LoginResponse, RefreshResponse } from './types';

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

export async function refreshRequest(
  refreshToken: string,
): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuth: true,
  });
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await apiFetch('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}
