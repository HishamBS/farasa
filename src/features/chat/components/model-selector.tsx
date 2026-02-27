'use client'

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import { trpc } from '@/trpc/provider'
import { fadeInDown, chevronSpin } from '@/lib/utils/motion'
import { LIMITS, PROVIDER_DOT_CLASSES } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import type { ModelConfig } from '@/schemas/model'

export type ModelSelectorHandle = {
  open: () => void
}

type ModelSelectorProps = {
  value: string | undefined
  onChange: (modelId: string | undefined) => void
}

export const ModelSelector = forwardRef<ModelSelectorHandle, ModelSelectorProps>(
  function ModelSelector({ value, onChange }, ref) {
    const shouldReduce = useReducedMotion()
    const [open, setOpen] = useState(false)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

    useImperativeHandle(ref, () => ({
      open: () => {
        setOpen(true)
        setFocusedIndex(0)
      },
    }))

    const { data: models = [] } = trpc.model.list.useQuery(undefined, {
      staleTime: LIMITS.MODEL_REGISTRY_CACHE_TTL_MS,
    })

    // Flat ordered list for keyboard navigation: Auto at index 0, then all models
    const flatItems = useMemo(
      () => [undefined as string | undefined, ...models.map((m) => m.id)],
      [models],
    )

    // Pre-computed global nav index for each model (Auto occupies index 0)
    const modelIndexMap = useMemo(() => {
      const map = new Map<string, number>()
      models.forEach((m, i) => map.set(m.id, i + 1))
      return map
    }, [models])

    const grouped = useMemo(
      () =>
        models.reduce<Record<string, ModelConfig[]>>((acc, m) => {
          const provider = m.provider
          const existing = acc[provider] ?? []
          existing.push(m)
          acc[provider] = existing
          return acc
        }, {}),
      [models],
    )

    const { selected, dotClass } = useMemo(() => {
      const sel = models.find((m) => m.id === value)
      const prov = sel?.provider ?? ''
      return {
        selected: sel,
        dotClass: PROVIDER_DOT_CLASSES[prov] ?? 'bg-[--text-ghost]',
      }
    }, [models, value])

    const handleSelect = useCallback(
      (modelId: string | undefined) => {
        onChange(modelId)
        setOpen(false)
        setFocusedIndex(-1)
      },
      [onChange],
    )

    const handleSelectAuto = useCallback(() => handleSelect(undefined), [handleSelect])
    const handleToggle = useCallback(() => {
      setOpen((p) => {
        if (p) setFocusedIndex(-1)
        return !p
      })
    }, [])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!open) {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
            setFocusedIndex(0)
          }
          return
        }
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setFocusedIndex((i) => Math.min(i + 1, flatItems.length - 1))
            break
          case 'ArrowUp':
            e.preventDefault()
            setFocusedIndex((i) => Math.max(i - 1, 0))
            break
          case 'Enter': {
            e.preventDefault()
            if (focusedIndex >= 0 && focusedIndex < flatItems.length) {
              handleSelect(flatItems[focusedIndex])
            }
            break
          }
          case 'Escape':
            e.preventDefault()
            setOpen(false)
            setFocusedIndex(-1)
            break
        }
      },
      [open, focusedIndex, flatItems, handleSelect],
    )

    // Move DOM focus to tracked item when focusedIndex changes
    useEffect(() => {
      if (focusedIndex >= 0) {
        itemRefs.current[focusedIndex]?.focus()
      }
    }, [focusedIndex])

    // Close on outside click
    useEffect(() => {
      if (!open) return
      const handler = (e: MouseEvent) => {
        // EventTarget is always a Node in a DOM MouseEvent
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
          setFocusedIndex(-1)
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [open])

    return (
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        <button
          type="button"
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={value ? `Model: ${selected?.name ?? value}` : 'Model: Auto'}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[--text-ghost] transition-colors hover:bg-[--bg-surface-hover] hover:text-[--text-muted]"
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
          <motion.span
            className="inline-flex"
            animate={shouldReduce ? {} : { rotate: open ? 180 : 0 }}
            transition={chevronSpin}
          >
            <ChevronDown className="size-3" />
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              role="listbox"
              aria-label="Select model"
              className="absolute bottom-full left-0 z-50 mb-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-[--border-subtle] bg-[--bg-glass] shadow-xl shadow-black/20 backdrop-blur-lg"
              {...(shouldReduce ? {} : fadeInDown)}
            >
              <div className="p-1">
                <button
                  ref={(el) => {
                    itemRefs.current[0] = el
                  }}
                  type="button"
                  role="option"
                  aria-selected={!value}
                  tabIndex={focusedIndex === 0 ? 0 : -1}
                  onClick={handleSelectAuto}
                  className={cn(
                    'flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[--bg-surface-hover]',
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
                    <span className="text-xs font-medium uppercase tracking-wider text-[--text-ghost]">
                      {provider}
                    </span>
                  </div>
                  {providerModels.map((m) => {
                    const idx = modelIndexMap.get(m.id)
                    if (idx === undefined) return null
                    return (
                      <button
                        key={m.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el
                        }}
                        type="button"
                        role="option"
                        aria-selected={value === m.id}
                        tabIndex={focusedIndex === idx ? 0 : -1}
                        onClick={() => handleSelect(m.id)}
                        className={cn(
                          'flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[--bg-surface-hover]',
                          value === m.id && 'bg-[--accent-muted] text-[--accent]',
                        )}
                      >
                        <span className="flex-1 truncate font-mono">{m.name}</span>
                        <span className="shrink-0 text-[--text-ghost]">
                          {Math.round(m.contextWindow / LIMITS.TOKENS_PER_K)}k
                        </span>
                        <span className="shrink-0 text-[--text-ghost]">
                          ${m.pricing.promptPerMillion}/M
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  },
)
