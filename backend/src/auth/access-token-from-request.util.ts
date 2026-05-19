import type { Request } from 'express';
import { AUTH_COOKIE_NAMES } from './auth-cookie.constants';

export function accessTokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAMES.access];
  return typeof fromCookie === 'string' && fromCookie.length > 0
    ? fromCookie
    : null;
}

export function refreshTokenFromRequest(
  req: Request,
  bodyRefresh?: string,
): string | null {
  if (bodyRefresh?.trim()) return bodyRefresh.trim();
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAMES.refresh];
  return typeof fromCookie === 'string' && fromCookie.length > 0
    ? fromCookie
    : null;
}
