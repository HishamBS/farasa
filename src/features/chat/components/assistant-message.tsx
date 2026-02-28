'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '@/lib/utils/motion'
import { ModelBadge } from '@/features/stream-phases/components/model-badge'
import { ThinkingBlock } from '@/features/stream-phases/components/thinking-block'
import { ToolExecution } from '@/features/stream-phases/components/tool-execution'
import { MarkdownRenderer } from '@/features/markdown/components/markdown-renderer'
import { A2UIMessage } from '@/features/a2ui/components/a2ui-message'
import { TTSControls } from '@/features/voice/components/tts-controls'
import { CHAT_STREAM_STATUS, STREAM_PHASES } from '@/config/constants'
import type { StreamState } from '@/types/stream'

type AssistantMessageProps = {
  streamState: StreamState
}

export function AssistantMessage({ streamState }: AssistantMessageProps) {
  const shouldReduce = useReducedMotion()

  const isRouting = streamState.statusMessages.some(
    (s) => s.phase === STREAM_PHASES.ROUTING && !s.completedAt,
  )

  const isActive = streamState.phase === CHAT_STREAM_STATUS.ACTIVE

  return (
    <motion.div className="flex flex-col gap-3" {...(shouldReduce ? {} : fadeInUp)}>
      <ModelBadge isRouting={isRouting || isActive} modelSelection={streamState.modelSelection} />

      {streamState.thinking && <ThinkingBlock thinking={streamState.thinking} />}

      {streamState.toolExecutions.length > 0 && (
        <motion.div className="flex flex-col gap-2" {...(shouldReduce ? {} : staggerContainer)}>
          {streamState.toolExecutions.map((execution, i) => (
            <ToolExecution key={i} execution={execution} />
          ))}
        </motion.div>
      )}

      {streamState.textContent && <MarkdownRenderer content={streamState.textContent} />}

      {streamState.a2uiMessages.length > 0 && <A2UIMessage messages={streamState.a2uiMessages} />}

      {streamState.textContent && (
        <div className="flex items-center">
          <TTSControls content={streamState.textContent} />
        </div>
      )}
    </motion.div>
  )
}
