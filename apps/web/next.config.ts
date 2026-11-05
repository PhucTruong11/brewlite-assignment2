import type { NextConfig } from 'next';

// Tự động cắt bỏ '/api' hoặc dấu '/' ở cuối URL nếu có để chống lặp
const rawApiUrl =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';
const backendBaseUrl = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');


const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    imageSizes: [64, 96, 128, 256],
    deviceSizes: [640, 750, 828, 1080],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;