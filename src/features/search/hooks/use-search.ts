'use client'

import { trpc } from '@/trpc/provider'

export function useSearch() {
  const mutation = trpc.search.execute.useMutation()

  return {
    search: mutation.mutate,
    searchAsync: mutation.mutateAsync,
    results: mutation.data?.results ?? [],
    images: mutation.data?.images ?? [],
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
