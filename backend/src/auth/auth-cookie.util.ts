import type { Response } from 'express';
import { AUTH_COOKIE_NAMES } from './auth-cookie.constants';

const ACCESS_MS = parseDurationMs(
  process.env.JWT_ACCESS_EXPIRATION ?? '1h',
  60 * 60 * 1000,
);
const REFRESH_MS = parseDurationMs(
  process.env.JWT_REFRESH_EXPIRATION ?? '30d',
  30 * 24 * 60 * 60 * 1000,
);

function parseDurationMs(raw: string, fallback: number): number {
  const m = raw.trim().match(/^(\d+)([smhd])$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult =
    unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

function baseCookieOptions() {
  const secure =
    process.env.USE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  const base = baseCookieOptions();
  res.cookie(AUTH_COOKIE_NAMES.access, accessToken, {
    ...base,
    maxAge: ACCESS_MS,
  });
  res.cookie(AUTH_COOKIE_NAMES.refresh, refreshToken, {
    ...base,
    maxAge: REFRESH_MS,
  });
}

export function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAMES.access, base);
  res.clearCookie(AUTH_COOKIE_NAMES.refresh, base);
}
