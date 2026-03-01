import { ChatContainer } from '@/features/chat/components/chat-container'
import { ErrorBoundary } from '@/components/error-boundary'

type PageProps = {
  params: Promise<{ id?: string[] }>
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params
  const conversationId = id?.[0]
  return (
    <ErrorBoundary>
      <ChatContainer conversationId={conversationId} />
    </ErrorBoundary>
  )
}
