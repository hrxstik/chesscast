import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { applyLanDevEnv, printLanBanner } from '../../scripts/lan-env.mjs';

import { fileURLToPath } from 'url';

const frontendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(frontendDir, '.env') });
config({ path: path.join(frontendDir, '.env.local'), override: true });

const localAppData = process.env.LOCALAPPDATA || process.env.HOME;
const rootCA = localAppData ? path.join(localAppData, 'mkcert', 'rootCA.pem') : '';
if (rootCA && fs.existsSync(rootCA)) {
  process.env.NODE_EXTRA_CA_CERTS = path.resolve(rootCA);
}

const { frontOrigin, apiOrigin, protocol } = applyLanDevEnv({ https: true });
printLanBanner({ frontOrigin, apiOrigin, protocol });

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'https-dev-server.ts'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    cwd: frontendDir,
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
