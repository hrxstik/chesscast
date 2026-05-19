import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { getLanIp } from './lib/utils';

config({ path: path.join(__dirname, '.env') });
config({ path: path.join(__dirname, '.env.local'), override: true });

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const certPath = process.env.SSL_CERT_PATH
  ? path.resolve(__dirname, process.env.SSL_CERT_PATH)
  : '';
const keyPath = process.env.SSL_KEY_PATH ? path.resolve(__dirname, process.env.SSL_KEY_PATH) : '';

if (!certPath || !keyPath || !fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ HTTPS certs not found. Set SSL_CERT_PATH and SSL_KEY_PATH in .env');
  console.error('Example: SSL_CERT_PATH=../localhost+1.pem SSL_KEY_PATH=../localhost+1-key.pem');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

app.prepare().then(() => {
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
      console.log('');
      console.log(`  Local:   https://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
      if (hostname === '0.0.0.0') {
        const lanIp = getLanIp();
        if (lanIp) {
          console.log(`  Network: https://${lanIp}:${port}`);
        }
      }
      console.log('');
    })
    .on('error', (err) => {
      console.error('HTTPS server error:', err);
    });
});
