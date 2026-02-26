import { ChatContainer } from '@/features/chat/components/chat-container'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ChatByIdPage({ params }: PageProps) {
  const { id } = await params
  return <ChatContainer conversationId={id} />
}
