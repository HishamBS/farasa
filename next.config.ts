import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'openrouter.ai',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.openrouter.ai',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
