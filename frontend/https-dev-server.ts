import { createServer, type ServerOptions } from 'node:https';
import { parse } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { applyLanDevEnv, printLanBanner } from '../scripts/lan-env.mjs';

const frontendDir = __dirname;
config({ path: path.join(frontendDir, '.env') });
config({ path: path.join(frontendDir, '.env.local'), override: true });

const { frontOrigin, apiOrigin, protocol } = applyLanDevEnv({ https: true });

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const certPath = process.env.SSL_CERT_PATH
  ? path.resolve(frontendDir, process.env.SSL_CERT_PATH)
  : '';
const keyPath = process.env.SSL_KEY_PATH
  ? path.resolve(frontendDir, process.env.SSL_KEY_PATH)
  : '';

if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ HTTPS certs not found. Set SSL_CERT_PATH and SSL_KEY_PATH in frontend/.env');
  console.error('  mkcert -install && mkcert localhost 127.0.0.1 YOUR_LAN_IP');
  process.exit(1);
}

const httpsOptions: ServerOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

async function main() {
  const next = (await import('next')).default;
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .listen({ port, host: hostname }, () => {
      printLanBanner({ frontOrigin, apiOrigin, protocol });
    })
    .on('error', (err) => {
      console.error('HTTPS server error:', err);
    });
}

void main();
