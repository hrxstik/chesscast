const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const localAppData = process.env.LOCALAPPDATA || process.env.HOME;
const rootCA = localAppData ? path.join(localAppData, 'mkcert', 'rootCA.pem') : '';
if (rootCA && fs.existsSync(rootCA)) {
  process.env.NODE_EXTRA_CA_CERTS = path.resolve(rootCA);
}

const frontendDir = path.join(__dirname, '..');
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
child.on('exit', (code: number | null) => process.exit(code ?? 0));
