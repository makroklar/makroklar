import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/contact', destination: '/kontakt', permanent: true }];
  },
};

export default nextConfig;
