'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { ImageComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { useA2UIPolicy } from '@/features/a2ui/context/policy-context'
import { isAllowedA2UIImageUrl } from '@/lib/security/runtime-safety'

export function ImageAdapter({ surfaceId, url, fit }: BaseComponentProps & ImageComponentProps) {
  const resolvedUrl = useDataBinding<string>(surfaceId, url, '')
  const policy = useA2UIPolicy()

  if (!resolvedUrl || !policy) return null
  if (!isAllowedA2UIImageUrl(resolvedUrl, policy.image)) return null

  const objectFit = fit ?? 'contain'

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Dynamic URL from A2UI message payload; next/image requires configured remote patterns
    <img src={resolvedUrl} alt="" className="max-w-full rounded-xl" style={{ objectFit }} />
  )
}
