import { apiFetch } from './client';
import type { AuthUserDto, LoginResponse } from './types';

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

/** Refresh по HttpOnly cookie, тело не передаём. */
export async function refreshSession(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
  });
}

export async function logoutRequest(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

/** Тикет для Socket.IO (обход проблем с cookie в WS handshake). */
export async function fetchWsTicket(): Promise<string> {
  const res = await apiFetch<{ ticket: string }>('/auth/ws-ticket');
  return res.ticket;
}

export type { AuthUserDto };
