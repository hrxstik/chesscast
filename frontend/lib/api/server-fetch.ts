import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

const devHttpsAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export function getServerApiBase(): string {
  const raw =
    process.env.NEST_INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_NEST_API_URL ||
    process.env.NEST_URL ||
    'http://127.0.0.1:5000/api';
  const base = raw.replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

export async function serverApiFetch(path: string, init?: UndiciRequestInit) {
  const url = path.startsWith('http')
    ? path
    : `${getServerApiBase()}${path.startsWith('/') ? path : `/${path}`}`;

  const options: UndiciRequestInit = {
    ...init,
    ...(url.startsWith('https://') ? { dispatcher: devHttpsAgent } : {}),
  };

  return undiciFetch(url, options);
}
