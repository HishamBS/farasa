'use client'

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { SidebarContainer } from '@/features/sidebar/components/sidebar-container'
import { SidebarHeader } from '@/features/sidebar/components/sidebar-header'
import { ConversationList } from '@/features/sidebar/components/conversation-list'
import { UserMenu } from '@/features/sidebar/components/user-menu'
import { useSidebar } from '@/features/sidebar/hooks/use-sidebar'
import { Titlebar } from '@/features/chat/components/titlebar'
import { PhaseBar } from '@/features/chat/components/phase-bar'
import { ChatModeProvider } from '@/features/chat/context/chat-mode-context'
import { StreamPhaseProvider, useStreamPhase } from '@/features/chat/context/stream-phase-context'
import { GroupModeProvider } from '@/features/group/context/group-context'

type ProtectedShellProps = {
  children: ReactNode
}

type TitlebarWithPhaseProps = {
  onMenuClick: () => void
}

function TitlebarWithPhase({ onMenuClick }: TitlebarWithPhaseProps) {
  const { phase, modelSelection, hasText } = useStreamPhase()
  return (
    <Titlebar
      onMenuClick={onMenuClick}
      streamPhase={phase}
      modelSelection={modelSelection}
      hasText={hasText}
    />
  )
}

export function ProtectedShell({ children }: ProtectedShellProps) {
  const { isOpen, open, close } = useSidebar()
  const [searchValue, setSearchValue] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleMenuClick = useCallback(() => open(), [open])
  const handleSearchToggle = useCallback(() => {
    setIsSearchOpen((prev) => !prev)
  }, [])

  return (
    <ChatModeProvider>
      <GroupModeProvider>
        <StreamPhaseProvider>
          <div className="flex h-screen overflow-hidden bg-[--bg-root]">
            <SidebarContainer isOpen={isOpen} onClose={close} onOpen={open}>
              <SidebarHeader
                isSearchOpen={isSearchOpen}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onClose={close}
                onSearchToggle={handleSearchToggle}
              />
              <div className="flex-1 overflow-y-auto py-2">
                <ConversationList search={searchValue} />
              </div>
              <UserMenu />
            </SidebarContainer>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <TitlebarWithPhase onMenuClick={handleMenuClick} />
              <PhaseBar />
              <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
            </div>
          </div>
        </StreamPhaseProvider>
      </GroupModeProvider>
    </ChatModeProvider>
  )
}
