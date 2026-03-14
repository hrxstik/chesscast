import { spawn } from 'child_process';
import { getLanIp } from '../lib/utils';

const lanIp = getLanIp();
const port = process.env.PORT || 3000;

console.log('');
console.log('  Local:   http://localhost:' + port);
if (lanIp) {
  console.log('  Network: http://' + lanIp + ':' + port);
}
console.log('');

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'dev', '-H', '0.0.0.0'],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' },
);
child.on('exit', (code) => process.exit(code ?? 0));
