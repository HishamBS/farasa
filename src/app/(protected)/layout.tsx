'use client'

import { useCallback } from 'react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { SidebarContainer } from '@/features/sidebar/components/sidebar-container'
import { SidebarHeader } from '@/features/sidebar/components/sidebar-header'
import { ConversationList } from '@/features/sidebar/components/conversation-list'
import { UserMenu } from '@/features/sidebar/components/user-menu'
import { useSidebar } from '@/features/sidebar/hooks/use-sidebar'
import { Titlebar } from '@/features/chat/components/titlebar'
import { ChatModeProvider } from '@/features/chat/context/chat-mode-context'
import { StreamPhaseProvider, useStreamPhase } from '@/features/chat/context/stream-phase-context'

function TitlebarWithPhase({ onMenuClick }: { onMenuClick: () => void }) {
  const { phase } = useStreamPhase()
  return <Titlebar onMenuClick={onMenuClick} streamPhase={phase} />
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isOpen, open, close } = useSidebar()
  const [searchValue, setSearchValue] = useState('')

  const handleMenuClick = useCallback(() => open(), [open])

  return (
    <ChatModeProvider>
      <StreamPhaseProvider>
        <div className="flex h-screen overflow-hidden bg-[--bg-root]">
          <SidebarContainer isOpen={isOpen} onClose={close} onOpen={open}>
            <SidebarHeader searchValue={searchValue} onSearchChange={setSearchValue} />
            <div className="flex-1 overflow-y-auto py-2">
              <ConversationList search={searchValue} />
            </div>
            <UserMenu />
          </SidebarContainer>

          <div className="flex flex-1 flex-col overflow-hidden">
            <TitlebarWithPhase onMenuClick={handleMenuClick} />
            <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
          </div>
        </div>
      </StreamPhaseProvider>
    </ChatModeProvider>
  )
}
