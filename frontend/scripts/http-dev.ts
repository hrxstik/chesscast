import { spawn } from 'child_process';
import { getLanIp } from '../lib/utils';

const port = process.env.PORT || 3000;
const host = process.env.HOSTNAME ?? '0.0.0.0';

console.log('');
console.log('  Local:   http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port);
if (host === '0.0.0.0') {
  const lanIp = getLanIp();
  if (lanIp) console.log('  Network: http://' + lanIp + ':' + port);
}
console.log('');

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-H', host], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
