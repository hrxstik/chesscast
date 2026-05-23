import { networkInterfaces } from 'node:os';

const VIRTUAL = /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;

/** LAN IPv4 for WebRTC ICE when MEDIASOUP_ANNOUNCED_IP is not set. */
export function resolveMediasoupAnnouncedIp(): string {
  const manual = process.env.MEDIASOUP_ANNOUNCED_IP?.trim();
  if (manual) return manual;

  const manualLan = process.env.LAN_IP?.trim();
  if (manualLan) return manualLan;

  for (const name of Object.keys(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const iface of networkInterfaces()[name] || []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        (iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          iface.address.startsWith('172.'))
      ) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
