import { TRPCClientError } from '@trpc/client'
import { TRPC_CODES } from '@/config/constants'

export function isTrpcUnauthorizedError(error: unknown): boolean {
  return error instanceof TRPCClientError && error.data?.code === TRPC_CODES.UNAUTHORIZED
}
