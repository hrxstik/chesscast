import { spawn } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyLanDevEnv, printLanBanner } from '../../scripts/lan-env.mjs';

const frontendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(frontendDir, '.env') });
config({ path: path.join(frontendDir, '.env.local'), override: true });

const frontPort = process.env.PORT ?? '3000';
const { frontOrigin, apiOrigin, protocol, frontendOrigins } = applyLanDevEnv({
  https: false,
  frontPort,
  apiPort: '5000',
});
printLanBanner({ frontOrigin, apiOrigin, protocol, frontendOrigins });

const port = process.env.PORT || '3000';
const host = process.env.HOSTNAME ?? '0.0.0.0';

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '-H', host, '-p', port],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    cwd: frontendDir,
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
