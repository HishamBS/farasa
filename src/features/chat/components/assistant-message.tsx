'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { CHAT_STREAM_STATUS } from '@/config/constants'
import { AssistantFrame } from './assistant-frame'
import type { StreamState } from '@/types/stream'

type AssistantMessageProps = {
  streamState: StreamState
}

function extractModelName(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? (parts.slice(1).join('/') ?? modelId) : modelId
}

export function AssistantMessage({ streamState }: AssistantMessageProps) {
  const shouldReduce = useReducedMotion()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE

  const modelLabel = streamState.modelSelection
    ? extractModelName(streamState.modelSelection.model)
    : null

  return (
    <motion.div {...(shouldReduce ? {} : fadeInUp)}>
      <AssistantFrame modelLabel={modelLabel} tokenLabel={null} isStreaming={isStreaming}>
        <div className="space-y-3">
          {streamState.thinking && <ThinkingBlock thinking={streamState.thinking} />}

          {streamState.toolExecutions.length > 0 && (
            <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
              {streamState.toolExecutions.map((execution, i) => (
                <ToolExecution key={i} execution={execution} />
              ))}
            </motion.div>
          )}

          {streamState.textContent && <MarkdownRenderer content={streamState.textContent} />}
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse rounded-sm bg-(--accent) align-middle" />
          )}

          {streamState.a2uiMessages.length > 0 && (
            <A2UIMessage messages={streamState.a2uiMessages} />
          )}

          {streamState.textContent && (
            <div className="flex items-center">
              <TTSControls content={streamState.textContent} />
            </div>
          )}
        </div>
      </AssistantFrame>
    </motion.div>
  )
}
