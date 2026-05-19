import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { networkInterfaces } from 'os';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL REST API (задаётся при старте dev из scripts/lan-env.mjs). */
export function getApiUrl(): string {
  const pub = process.env.NEXT_PUBLIC_NEST_API_URL?.trim();
  if (pub) return pub.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const port = process.env.NEXT_PUBLIC_NEST_WS_PORT || '5000';
    return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
  }

  return 'http://127.0.0.1:5000/api';
}

export function getWsUrl(): string {
  const api = getApiUrl().replace(/\/api\/?$/, '');
  return `${api.replace(/^http/, 'ws')}/ws`;
}

const VIRTUAL_ADAPTER_NAMES =
  /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;

export function getLanIp(): string | null {
  const manual = process.env.LAN_IP?.trim();
  if (manual) return manual;

  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    if (VIRTUAL_ADAPTER_NAMES.test(name)) continue;
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        (iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.'))
      ) {
        return iface.address;
      }
    }
  }
  return null;
}
