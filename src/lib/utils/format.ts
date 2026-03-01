import { APP_CONFIG } from '@/config/constants'

export function formatDate(date: Date): string {
  return date.toLocaleDateString(APP_CONFIG.LOCALE, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatNumber(n: number): string {
  return n.toLocaleString(APP_CONFIG.LOCALE)
}

export function formatCost(usd: number): string {
  if (usd <= 0) return ''
  if (usd < 0.001) return '<0.1¢'
  if (usd < 0.01) return `${(usd * 100).toFixed(2)}¢`
  if (usd < 1) return `${(usd * 100).toFixed(1)}¢`
  return `$${usd.toFixed(2)}`
}

export function formatTokenCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`
}
