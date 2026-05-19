import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

/** SSR-запросы к локальному Nest по HTTPS с self-signed сертификатом. */
const devHttpsAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export function getServerApiBase(): string {
  const raw =
    process.env.NEST_INTERNAL_API_URL ||
    process.env.NEST_URL ||
    'https://127.0.0.1:5000';
  const base = raw.replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

export async function serverApiFetch(
  path: string,
  init?: UndiciRequestInit,
) {
  const url = path.startsWith('http')
    ? path
    : `${getServerApiBase()}${path.startsWith('/') ? path : `/${path}`}`;

  return undiciFetch(url, {
    ...init,
    dispatcher: devHttpsAgent,
  });
}
