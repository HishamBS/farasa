import { trpc } from '@/trpc/provider'

export function useUpdatePreferences() {
  const utils = trpc.useUtils()
  return trpc.userPreferences.update.useMutation({
    onSettled: () => {
      void utils.userPreferences.get.invalidate()
    },
  })
}
