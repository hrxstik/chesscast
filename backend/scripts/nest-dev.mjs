import { config } from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyLanDevEnv, printLanBanner } from '../../scripts/lan-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, '..');

config({ path: path.join(backendDir, '.env') });

const https = process.env.USE_HTTPS === 'true' || process.env.USE_HTTPS === '1';
const { frontOrigin, apiOrigin, protocol } = applyLanDevEnv({ https });
printLanBanner({ frontOrigin, apiOrigin, protocol });

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['nest', 'start', '--watch'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    cwd: backendDir,
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
