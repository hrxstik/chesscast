import type { NextConfig } from 'next';
import { getLanIp } from './lib/utils';

const lanIp = getLanIp();

const apiOrigin = (
  process.env.NEST_URL ||
  process.env.NEXT_PUBLIC_NEST_API_URL?.replace(/\/api\/?$/, '') ||
  'http://127.0.0.1:5000'
).replace(/\/$/, '');

let nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiOrigin}/api/uploads/:path*`,
      },
    ];
  },
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
