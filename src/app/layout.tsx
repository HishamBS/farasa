import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { APP_CONFIG } from '@/config/constants'
import type { RootLayoutProps } from '@/types/layout'
import { TRPCProvider } from '@/trpc/provider'
import { AuthSessionProvider } from '@/components/session-provider'
import { OfflineBanner } from '@/features/pwa/components/offline-banner'
import { InstallPrompt } from '@/features/pwa/components/install-prompt'
import { DevServiceWorkerReset } from '@/features/pwa/components/dev-sw-reset'
import './globals.css'
import 'katex/dist/katex.min.css'

export const metadata: Metadata = {
  title: APP_CONFIG.NAME,
  description: 'AI Chat System',
}

export const viewport: Viewport = {
  themeColor: APP_CONFIG.THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme')??'${APP_CONFIG.DEFAULT_THEME}';document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <DevServiceWorkerReset />
        <OfflineBanner />
        <InstallPrompt />
        <AuthSessionProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
