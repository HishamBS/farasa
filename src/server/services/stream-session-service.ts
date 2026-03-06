import { STREAM_REASON_CODES, TRPC_CODES } from '@/config/constants'
import { AppError } from '@/lib/utils/errors'
import type { RuntimeConfig } from '@/schemas/runtime-config'
import type { StreamChunk } from '@/schemas/message'
import { TRPCError } from '@trpc/server'

type StreamSession = {
  key: string
  userId: string
  conversationId: string
  streamRequestId: string
  abortController: AbortController
}

type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never

type StreamChunkPayload = DistributiveOmit<StreamChunk, 'streamRequestId' | 'attempt' | 'sequence'>

class StreamSessionService {
  private readonly byConversation = new Map<string, StreamSession>()
  private readonly byRequest = new Map<string, StreamSession>()

  private getKey(userId: string, conversationId: string): string {
    return `${userId}:${conversationId}`
  }

  begin(params: {
    userId: string
    conversationId: string
    streamRequestId: string
  }): StreamSession {
    const byRequest = this.byRequest.get(params.streamRequestId)
    if (byRequest && byRequest.userId === params.userId) {
      throw new TRPCError({
        code: TRPC_CODES.BAD_REQUEST,
        message: AppError.DUPLICATE_STREAM,
      })
    }

    const key = this.getKey(params.userId, params.conversationId)
    const existing = this.byConversation.get(key)

    if (existing && existing.streamRequestId === params.streamRequestId) {
      throw new TRPCError({
        code: TRPC_CODES.BAD_REQUEST,
        message: AppError.DUPLICATE_STREAM,
      })
    }

    if (existing) {
      existing.abortController.abort(STREAM_REASON_CODES.SUPERSEDED)
      this.end(existing)
    }

    const session: StreamSession = {
      key,
      userId: params.userId,
      conversationId: params.conversationId,
      streamRequestId: params.streamRequestId,
      abortController: new AbortController(),
    }
    this.byConversation.set(key, session)
    this.byRequest.set(session.streamRequestId, session)
    return session
  }

  end(session: StreamSession): void {
    const activeForConversation = this.byConversation.get(session.key)
    if (activeForConversation?.streamRequestId === session.streamRequestId) {
      this.byConversation.delete(session.key)
    }
    const activeForRequest = this.byRequest.get(session.streamRequestId)
    if (activeForRequest?.key === session.key) {
      this.byRequest.delete(session.streamRequestId)
    }
  }

  findByConversation(userId: string, conversationId: string): StreamSession | undefined {
    return this.byConversation.get(this.getKey(userId, conversationId))
  }

  findByRequest(requestId: string): StreamSession | undefined {
    return this.byRequest.get(requestId)
  }

  cancelStream(
    userId: string,
    conversationId: string,
    streamRequestId?: string,
  ): { cancelled: false } | { cancelled: true; activeStreamRequestId: string } {
    const active = this.findByConversation(userId, conversationId)
    if (!active) return { cancelled: false }
    if (streamRequestId && active.streamRequestId !== streamRequestId) {
      return { cancelled: false }
    }
    const activeStreamRequestId = active.streamRequestId
    active.abortController.abort(STREAM_REASON_CODES.CANCELLED)
    this.end(active)
    return { cancelled: true, activeStreamRequestId }
  }

  createChunkEmitter(
    streamRequestId: string,
    attempt: number,
    enforceSequence: boolean,
  ): (payload: StreamChunkPayload) => StreamChunk {
    let sequence = 0
    return (payload: StreamChunkPayload): StreamChunk => {
      const base = {
        ...payload,
        streamRequestId,
        attempt,
      } as StreamChunk
      if (!enforceSequence) {
        return base
      }
      return {
        ...base,
        sequence: sequence++,
      }
    }
  }

  buildCombinedAbortSignal(
    signals: AbortSignal[],
    timeoutMs: number,
  ): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    const subscriptions: Array<() => void> = []
    for (const candidate of signals) {
      if (candidate.aborted) {
        clearTimeout(timeoutId)
        controller.abort()
        break
      }
      const onAbort = (): void => {
        controller.abort()
      }
      candidate.addEventListener('abort', onAbort, { once: true })
      subscriptions.push(() => candidate.removeEventListener('abort', onAbort))
    }

    const cleanup = (): void => {
      clearTimeout(timeoutId)
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
    }

    controller.signal.addEventListener('abort', cleanup, { once: true })

    return { signal: controller.signal, cleanup }
  }

  classifyTerminalError(
    runtimeConfig: RuntimeConfig,
    error: unknown,
  ): {
    message: string
    code?: string
    reasonCode: string
    recoverable: boolean
  } {
    if (error instanceof TRPCError) {
      if (error.code === TRPC_CODES.UNAUTHORIZED || error.code === TRPC_CODES.FORBIDDEN) {
        return {
          message: runtimeConfig.chat.errors.unauthorized,
          code: error.code,
          reasonCode: STREAM_REASON_CODES.AUTHORIZATION_EXPIRED,
          recoverable: false,
        }
      }
      if (error.code === TRPC_CODES.BAD_REQUEST) {
        const invalidModel = error.message === AppError.INVALID_MODEL
        const routerFailed = error.message === AppError.ROUTER_FAILED
        const a2uiContractFailed = error.message === AppError.A2UI_CONTRACT_FAILED
        const imageGenIncompatible = error.message === AppError.IMAGE_GEN_INCOMPATIBLE
        const imageGenEmptyResult = error.message === AppError.IMAGE_GEN_EMPTY_RESULT
        return {
          message: routerFailed
            ? AppError.ROUTER_FAILED
            : a2uiContractFailed
              ? AppError.A2UI_CONTRACT_FAILED
              : imageGenIncompatible
                ? runtimeConfig.chat.errors.imageGenIncompatible
                : imageGenEmptyResult
                  ? runtimeConfig.chat.errors.processing
                  : invalidModel
                    ? runtimeConfig.chat.errors.invalidModel
                    : runtimeConfig.chat.errors.processing,
          code: error.code,
          reasonCode: routerFailed
            ? STREAM_REASON_CODES.ROUTER_FAILED
            : a2uiContractFailed
              ? STREAM_REASON_CODES.A2UI_CONTRACT_VIOLATION
              : imageGenIncompatible
                ? STREAM_REASON_CODES.IMAGE_GEN_INCOMPATIBLE
                : imageGenEmptyResult
                  ? STREAM_REASON_CODES.IMAGE_GEN_EMPTY_RESULT
                  : STREAM_REASON_CODES.VALIDATION_REJECTED,
          recoverable:
            routerFailed || a2uiContractFailed || imageGenIncompatible || imageGenEmptyResult,
        }
      }
      return {
        message: runtimeConfig.chat.errors.processing,
        code: error.code,
        reasonCode: STREAM_REASON_CODES.PROVIDER_UNAVAILABLE,
        recoverable: true,
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes('abort') || message.includes('timeout')) {
        return {
          message: runtimeConfig.chat.errors.connection,
          code: error.name,
          reasonCode: STREAM_REASON_CODES.TRANSIENT_NETWORK,
          recoverable: true,
        }
      }
    }

    return {
      message: runtimeConfig.chat.errors.providerUnavailable,
      reasonCode: STREAM_REASON_CODES.PROVIDER_UNAVAILABLE,
      recoverable: true,
    }
  }
}

export type { StreamSession }
export const streamSessions = new StreamSessionService()
