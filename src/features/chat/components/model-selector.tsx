'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { fadeInDown } from '@/lib/utils/motion'
import { PROVIDERS } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { ModelConfig } from '@/schemas/model'

const PROVIDER_DOT_CLASSES: Record<string, string> = {
  [PROVIDERS.ANTHROPIC]: 'bg-[--provider-anthropic]',
  [PROVIDERS.OPENAI]: 'bg-[--provider-openai]',
  [PROVIDERS.GOOGLE]: 'bg-[--provider-google]',
  [PROVIDERS.META]: 'bg-[--provider-meta]',
  [PROVIDERS.GROQ]: 'bg-[--provider-groq]',
  [PROVIDERS.CEREBRAS]: 'bg-[--provider-cerebras]',
}

type ModelSelectorProps = {
  value: string | undefined
  onChange: (modelId: string | undefined) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const shouldReduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: models = [] } = trpc.model.list.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  })

  const grouped = models.reduce<Record<string, ModelConfig[]>>((acc, m) => {
    const provider = m.id.split('/')[0] ?? 'other'
    const existing = acc[provider] ?? []
    existing.push(m)
    acc[provider] = existing
    return acc
  }, {})

  const selected = models.find((m) => m.id === value)
  const selectedProvider = selected?.id.split('/')[0] ?? ''
  const dotClass = PROVIDER_DOT_CLASSES[selectedProvider] ?? 'bg-[--text-ghost]'

  const handleSelect = useCallback(
    (modelId: string | undefined) => {
      onChange(modelId)
      setOpen(false)
    },
    [onChange],
  )

  const handleToggle = useCallback(() => setOpen((p) => !p), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="flex min-h-7 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[--text-ghost] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-muted]"
      >
        {value ? (
          <>
            <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
            <span className="max-w-28 truncate font-mono">{selected?.name ?? value}</span>
          </>
        ) : (
          <>
            <Sparkles className="size-3" />
            <span>Auto</span>
          </>
        )}
        <ChevronDown className={cn('size-3 transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-full left-0 z-50 mb-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-[--border-subtle] bg-[--bg-glass] shadow-xl shadow-black/20 backdrop-blur-lg"
            {...(shouldReduce ? {} : fadeInDown)}
          >
            <div className="p-1">
              <button
                type="button"
                onClick={() => handleSelect(undefined)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[--bg-surface-hover]',
                  !value && 'bg-[--accent-muted] text-[--accent]',
                )}
              >
                <Sparkles className="size-3 shrink-0" />
                <span className="font-medium">Auto</span>
                <span className="ml-auto text-[--text-ghost]">Router picks</span>
              </button>
            </div>

            <div className="mx-1 border-t border-[--border-subtle]" />

            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider} className="p-1">
                <div className="flex items-center gap-1.5 px-3 py-1">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      PROVIDER_DOT_CLASSES[provider] ?? 'bg-[--text-ghost]',
                    )}
                  />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[--text-ghost]">
                    {provider}
                  </span>
                </div>
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[--bg-surface-hover]',
                      value === m.id && 'bg-[--accent-muted] text-[--accent]',
                    )}
                  >
                    <span className="flex-1 truncate font-mono">{m.name}</span>
                    <span className="shrink-0 text-[--text-ghost]">
                      {Math.round(m.contextWindow / 1000)}k
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
