import type { MetadataRoute } from 'next'
import { APP_CONFIG } from '@/config/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.NAME,
    short_name: APP_CONFIG.NAME,
    description: 'AI-powered chat assistant',
    start_url: '/',
    display: 'standalone',
    background_color: APP_CONFIG.THEME_COLOR,
    theme_color: APP_CONFIG.THEME_COLOR,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
