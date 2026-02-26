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
