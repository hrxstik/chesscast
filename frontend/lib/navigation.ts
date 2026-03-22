/**
 * Защита от open redirect: только относительные пути внутри приложения.
 */
export function safeNextPath(raw: string | null, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}
