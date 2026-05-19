import { networkInterfaces } from 'node:os';

const VIRTUAL = /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;

export function getLanIp() {
  const manual = process.env.LAN_IP?.trim();
  if (manual) return manual;

  for (const name of Object.keys(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const iface of networkInterfaces()[name] || []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        (iface.address.startsWith('192.168.') || iface.address.startsWith('10.'))
      ) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Прописывает URL для LAN: фронт :3000, API :5000 на одном IP.
 * @param {{ https?: boolean, frontPort?: string, apiPort?: string }} opts
 */
export function applyLanDevEnv(opts = {}) {
  const https =
    opts.https ??
    (process.env.USE_HTTPS === 'true' || process.env.USE_HTTPS === '1');
  const protocol = https ? 'https' : 'http';
  const lan = getLanIp();
  const frontPort = String(opts.frontPort ?? process.env.PORT ?? '3000');
  const apiPort = String(opts.apiPort ?? process.env.NEST_PORT ?? '5000');

  const apiOrigin = `${protocol}://${lan}:${apiPort}`;
  const frontOrigin = `${protocol}://${lan}:${frontPort}`;

  process.env.LAN_IP = lan;
  process.env.NEXT_PUBLIC_NEST_API_URL = `${apiOrigin}/api`;
  process.env.NEST_URL = apiOrigin;
  process.env.NEST_INTERNAL_API_URL = `${apiOrigin}/api`;
  process.env.NEXT_PUBLIC_NEST_WS_PORT = apiPort;
  process.env.FRONTEND_URL = frontOrigin;
  process.env.MEDIASOUP_ANNOUNCED_IP = lan;
  process.env.YOOKASSA_RETURN_URL = `${frontOrigin}/dashboard/profile?payment=success`;

  return { lan, protocol, apiOrigin, frontOrigin };
}

export function printLanBanner({ frontOrigin, apiOrigin, protocol }) {
  console.log('');
  console.log('  ChessCast LAN');
  console.log(`  Frontend:  ${frontOrigin}`);
  console.log(`  API:       ${apiOrigin}/api`);
  console.log(`  WebSocket: ${apiOrigin.replace(/^http/, 'ws')}/ws`);
  if (protocol === 'https') {
    console.log('  HTTPS: при первом заходе примите сертификат на фронте и на API.');
  }
  console.log('');
}
