import { getApiUrl } from '@/lib/utils';

const PLACEHOLDER_AVATARS = new Set(['default.png', '/default.png', '']);

/** Базовый origin API без суффикса /api */
function getApiOrigin(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

/**
 * Путь из БД → URL для <img>.
 * Как в news-portal: в UI относительный /uploads/..., фактически файл на Nest /api/uploads/...
 */
export function resolveAvatarSrc(avatar?: string | null): string | null {
  if (!avatar) return null;
  const trimmed = avatar.trim();
  if (PLACEHOLDER_AVATARS.has(trimmed)) return null;

  let path = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith('/uploads/')) {
        path = u.pathname;
      } else {
        return trimmed;
      }
    } catch {
      return trimmed;
    }
  }

  if (!path.startsWith('/uploads/')) {
    if (path.startsWith('/')) return `${getApiOrigin()}/api${path}`;
    return null;
  }

  return `${getApiOrigin()}/api${path}`;
}
