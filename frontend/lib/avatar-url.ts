import { getApiUrl } from '@/lib/utils';

const PLACEHOLDER_AVATARS = new Set(['default.png', '/default.png', '']);

/** Путь из БД → абсолютный URL для <img>. default.png → null. */
export function resolveAvatarSrc(avatar?: string | null): string | null {
  if (!avatar) return null;
  const trimmed = avatar.trim();
  if (PLACEHOLDER_AVATARS.has(trimmed)) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    const origin = getApiUrl().replace(/\/api\/?$/, '');
    return `${origin}${trimmed}`;
  }

  return null;
}
