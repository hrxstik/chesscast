import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { networkInterfaces } from 'os';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_NEST_API_URL?.replace(/\/api\/?$/, '');
  if (typeof window !== 'undefined') {
    if (fromEnv) return fromEnv;
    // За nginx: API на том же origin (/api), без :5000
    return window.location.origin;
  }
  return fromEnv || 'http://localhost:5000';
}

export function getApiUrl(): string {
  return `${getApiBaseUrl()}/api`;
}

export function getWsUrl(): string {
  return `${getApiBaseUrl()}/ws`;
}

const VIRTUAL_ADAPTER_NAMES = /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;

export function getLanIp(): string | null {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    if (VIRTUAL_ADAPTER_NAMES.test(name)) continue;
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        (iface.address.startsWith('192.168.') || iface.address.startsWith('10.'))
      ) {
        return iface.address;
      }
    }
  }
  return null;
}
