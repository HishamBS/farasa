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
import { ChevronDown, Sparkles, Search } from 'lucide-react'
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
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
    const runtimeConfigQuery = trpc.runtimeConfig.get.useQuery()

    useImperativeHandle(ref, () => ({
      open: () => {
        setOpen(true)
        setFocusedIndex(-1)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      },
    }))

    const { data: models = [] } = trpc.model.list.useQuery(undefined, {
      staleTime: runtimeConfigQuery.data?.models.registry.cacheTtlMs ?? 0,
    })

    const filteredModels = useMemo(
      () =>
        searchQuery
          ? models.filter(
              (m) =>
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.provider.toLowerCase().includes(searchQuery.toLowerCase()),
            )
          : models,
      [models, searchQuery],
    )

    // Flat ordered list for keyboard navigation: Auto at index 0, then all filtered models
    const flatItems = useMemo(
      () => [undefined as string | undefined, ...filteredModels.map((m) => m.id)],
      [filteredModels],
    )

    // Pre-computed global nav index for each model (Auto occupies index 0)
    const modelIndexMap = useMemo(() => {
      const map = new Map<string, number>()
      filteredModels.forEach((m, i) => map.set(m.id, i + 1))
      return map
    }, [filteredModels])

    const grouped = useMemo(
      () =>
        filteredModels.reduce<Record<string, ModelConfig[]>>((acc, m) => {
          const provider = m.provider
          const existing = acc[provider] ?? []
          existing.push(m)
          acc[provider] = existing
          return acc
        }, {}),
      [filteredModels],
    )

    const { selected, dotClass } = useMemo(() => {
      const sel = models.find((m) => m.id === value)
      const prov = sel?.provider ?? ''
      return {
        selected: sel,
        dotClass: PROVIDER_DOT_CLASSES[prov] ?? 'bg-(--text-ghost)',
      }
    }, [models, value])

    const handleSelect = useCallback(
      (modelId: string | undefined) => {
        onChange(modelId)
        setOpen(false)
        setFocusedIndex(-1)
        setSearchQuery('')
      },
      [onChange],
    )

    const handleSelectAuto = useCallback(() => handleSelect(undefined), [handleSelect])
    const handleToggle = useCallback(() => {
      setOpen((p) => {
        if (!p) {
          setFocusedIndex(-1)
          setTimeout(() => searchInputRef.current?.focus(), 0)
        } else {
          setFocusedIndex(-1)
          setSearchQuery('')
        }
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
            setFocusedIndex((i) => {
              if (i <= 0) {
                searchInputRef.current?.focus()
                return -1
              }
              return i - 1
            })
            break
          case 'Enter': {
            if (focusedIndex >= 0 && focusedIndex < flatItems.length) {
              e.preventDefault()
              handleSelect(flatItems[focusedIndex])
            }
            break
          }
          case 'Escape':
            e.preventDefault()
            setOpen(false)
            setFocusedIndex(-1)
            setSearchQuery('')
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
          setSearchQuery('')
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
          className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
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
              className="absolute bottom-full left-0 z-50 mb-1 flex max-h-80 w-88 flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-glass-strong) shadow-xl shadow-black/30 backdrop-blur-3xl"
              {...(shouldReduce ? {} : fadeInDown)}
            >
              <div className="border-b border-(--border-subtle) p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-(--text-ghost)" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full rounded-md bg-(--bg-surface) py-1.5 pl-8 pr-3 text-sm text-(--text-primary) placeholder:text-(--text-ghost) outline-none border border-transparent focus:border-(--border-default) focus:ring-1 focus:ring-(--accent-muted)"
                    // Prevent closing on space bar when searching
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div className="overflow-y-auto p-1">
                {(!searchQuery || 'auto'.includes(searchQuery.toLowerCase())) && (
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
                      'flex w-full min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-(--bg-surface-hover)',
                      !value && 'bg-(--accent-muted) text-accent',
                    )}
                  >
                    <Sparkles className="size-3 shrink-0" />
                    <span className="font-medium">Auto</span>
                    <span className="ml-auto text-(--text-ghost)">Router picks</span>
                  </button>
                )}

                <div className="mx-1 border-t border-(--border-subtle)" />

                {Object.entries(grouped).map(([provider, providerModels]) => (
                  <div key={provider} className="p-1">
                    <div className="flex items-center gap-1.5 px-3 py-1">
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          PROVIDER_DOT_CLASSES[provider] ?? 'bg-(--text-ghost)',
                        )}
                      />
                      <span className="text-xs font-medium uppercase tracking-wider text-(--text-ghost)">
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
                            'flex w-full min-h-10 flex-col gap-1 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-(--bg-surface-hover)',
                            value === m.id && 'bg-(--accent-muted) text-accent',
                          )}
                        >
                          <div className="flex w-full items-center gap-2">
                            <span className="flex-1 truncate font-mono">{m.name}</span>
                            <span className="shrink-0 text-(--text-ghost)">
                              {Math.round(m.contextWindow / LIMITS.TOKENS_PER_K)}k
                            </span>
                            <span className="shrink-0 text-(--text-ghost)">
                              ${m.pricing.promptPerMillion}/M
                            </span>
                          </div>
                          {(m.supportsThinking || m.supportsVision || m.supportsTools) && (
                            <div className="flex flex-wrap gap-1">
                              {m.supportsThinking && (
                                <span className="rounded-full bg-(--thinking)/10 px-1.5 py-0.5 text-[0.625rem] text-(--thinking)">
                                  Thinking
                                </span>
                              )}
                              {m.supportsVision && (
                                <span className="rounded-full bg-(--accent-muted) px-1.5 py-0.5 text-[0.625rem] text-accent">
                                  Vision
                                </span>
                              )}
                              {m.supportsTools && (
                                <span className="rounded-full bg-(--bg-surface-active) px-1.5 py-0.5 text-[0.625rem] text-(--text-muted)">
                                  Tools
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {Object.keys(grouped).length === 0 && searchQuery && (
                  <div className="px-4 py-8 text-center text-sm text-(--text-muted)">
                    No models found for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  },
)
