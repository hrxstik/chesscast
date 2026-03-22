import type { NextConfig } from 'next';
import { getLanIp } from './lib/utils';

const lanIp = getLanIp();
let nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

if (lanIp) {
  nextConfig.allowedDevOrigins = ['localhost', '127.0.0.1', lanIp];
}

export default nextConfig;
