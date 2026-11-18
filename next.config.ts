import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: 'security',
  },
  async redirects() {
    return [{ source: '/contact', destination: '/kontakt', permanent: true }];
  },
};

export default nextConfig;
