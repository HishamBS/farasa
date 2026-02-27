import type { NextConfig } from 'next'

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://openrouter.ai https://*.openrouter.ai https://storage.googleapis.com",
  "font-src 'self'",
  "connect-src 'self' https://openrouter.ai https://*.openrouter.ai https://api.tavily.com",
  "worker-src blob: 'self'",
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
]

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default nextConfig
