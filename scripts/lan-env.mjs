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
 * Важно: не использовать process.env.PORT бэкенда (5000) как порт фронта.
 *
 * @param {{ https?: boolean, frontPort?: string, apiPort?: string }} opts
 */
export function applyLanDevEnv(opts = {}) {
  const https =
    opts.https ??
    (process.env.USE_HTTPS === 'true' || process.env.USE_HTTPS === '1');
  const protocol = https ? 'https' : 'http';
  const lan = getLanIp();
  const frontPort = String(
    opts.frontPort ?? process.env.FRONTEND_PORT ?? '3000',
  );
  const apiPort = String(
    opts.apiPort ?? process.env.NEST_PORT ?? process.env.API_PORT ?? '5000',
  );

  const apiOrigin = `${protocol}://${lan}:${apiPort}`;
  const frontOrigin = `${protocol}://${lan}:${frontPort}`;

  const frontendOrigins = [
    frontOrigin,
    `${protocol}://localhost:${frontPort}`,
    `${protocol}://127.0.0.1:${frontPort}`,
  ];
  if (lan !== '127.0.0.1' && lan !== 'localhost') {
    frontendOrigins.push(`${protocol}://localhost:${frontPort}`);
  }

  process.env.LAN_IP = lan;
  // Браузер напрямую на Nest (mkcert в браузере); без прокси Next → нет TLS-ошибок Node.
  process.env.NEXT_PUBLIC_NEST_API_URL = `${apiOrigin}/api`;
  process.env.NEXT_PUBLIC_NEST_WS_URL = `${apiOrigin.replace(/^http/, 'ws')}/ws`;
  process.env.NEST_URL = apiOrigin;
  process.env.NEST_INTERNAL_API_URL = `${apiOrigin}/api`;
  process.env.NEXT_PUBLIC_NEST_WS_PORT = apiPort;
  process.env.FRONTEND_URL = [...new Set(frontendOrigins)].join(',');
  process.env.MEDIASOUP_ANNOUNCED_IP = lan;
  process.env.YOOKASSA_RETURN_URL = `${frontOrigin}/dashboard/profile?payment=success`;

  return { lan, protocol, apiOrigin, frontOrigin, frontendOrigins };
}

export function printLanBanner({ frontOrigin, apiOrigin, protocol, frontendOrigins }) {
  console.log('');
  console.log('  ChessCast LAN');
  console.log(`  Frontend:  ${frontOrigin}`);
  console.log(`  API:       ${apiOrigin}/api`);
  console.log(`  WebSocket: ${apiOrigin.replace(/^http/, 'ws')}/ws`);
  if (frontendOrigins?.length) {
    console.log(`  CORS origins: ${frontendOrigins.join(', ')}`);
  }
  if (protocol === 'https') {
    console.log('  HTTPS: при первом заходе примите сертификат на фронте И на API (:5000).');
  }
  console.log('');
}
