'use client'

type ChatContainerProps = {
  conversationId: string
}

export function ChatContainer({ conversationId: _conversationId }: ChatContainerProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto" />
    </div>
  )
}
