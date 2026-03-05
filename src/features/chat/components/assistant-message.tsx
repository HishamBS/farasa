'use client'

import { CHAT_STREAM_STATUS, MODEL_SELECTION_SOURCES } from '@/config/constants'
import { extractModelName } from '@/lib/utils/model'
import { fadeInUp } from '@/lib/utils/motion'
import type { StreamState } from '@/types/stream'
import { motion, useReducedMotion } from 'framer-motion'
import { AssistantBody } from './assistant-body'
import { AssistantFrame } from './assistant-frame'

type AssistantMessageProps = {
  streamState: StreamState
}

export function AssistantMessage({ streamState }: AssistantMessageProps) {
  const shouldReduce = useReducedMotion()
  const isStreaming = streamState.phase === CHAT_STREAM_STATUS.ACTIVE

  const modelLabel = streamState.modelSelection
    ? extractModelName(streamState.modelSelection.model)
    : null
  const showRouterDecision =
    streamState.modelSelection?.source === MODEL_SELECTION_SOURCES.AUTO_ROUTER
  const hasRoutingDecision = !!streamState.modelSelection && showRouterDecision

  return (
    <motion.div {...(shouldReduce ? {} : fadeInUp)}>
      <AssistantFrame modelLabel={modelLabel} tokenLabel={null} isStreaming={isStreaming}>
        <AssistantBody
          routingDecision={
            hasRoutingDecision && streamState.modelSelection
              ? {
                  modelLabel: modelLabel ?? streamState.modelSelection.model,
                  model: streamState.modelSelection.model,
                  category: streamState.modelSelection.category,
                  confidence: streamState.modelSelection.confidence,
                  factors: streamState.modelSelection.factors,
                  reasoning: streamState.modelSelection.reasoning,
                }
              : null
          }
          thinking={streamState.thinking}
          toolExecutions={streamState.toolExecutions}
          textContent={streamState.textContent}
          a2uiMessages={streamState.a2uiMessages}
          isStreaming={isStreaming}
          modelResolved={!!streamState.modelSelection}
          autoCollapse={streamState.phase === CHAT_STREAM_STATUS.COMPLETE}
        />
      </AssistantFrame>
    </motion.div>
  )
}
