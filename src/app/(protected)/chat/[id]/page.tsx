import { ChatContainer } from '@/features/chat/components/chat-container'
import { ErrorBoundary } from '@/components/error-boundary'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ChatByIdPage({ params }: PageProps) {
  const { id } = await params
  return (
    <ErrorBoundary>
      <ChatContainer conversationId={id} />
    </ErrorBoundary>
  )
}
