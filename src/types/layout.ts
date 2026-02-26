import type { ReactNode } from 'react'
import type { StreamPhase } from '@/schemas'

export type RootLayoutProps = {
  children: ReactNode
}

export type SidebarProps = {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
}

export type TitlebarProps = {
  title: string | null
  onMenuClick: () => void
}

export type PhaseBarProps = {
  isVisible: boolean
  message: string | null
  phase: StreamPhase | null
}
