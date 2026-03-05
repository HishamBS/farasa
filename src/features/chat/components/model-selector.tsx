'use client'

import { LIMITS, PROVIDER_DOT_CLASSES, UI_TEXT, UX } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { chevronSpin, fadeInDown } from '@/lib/utils/motion'
import type { ModelConfig } from '@/schemas/model'
import { trpc } from '@/trpc/provider'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Fuse from 'fuse.js'
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

export type ModelSelectorHandle = {
  open: () => void
}

type ModelSelectorProps = {
  value: string | undefined
  onChange: (modelId: string | undefined) => void
  includeAuto?: boolean
  excludedModelIds?: string[]
  emptyLabel?: string
  menuPlacement?: 'auto' | 'top' | 'bottom'
}

export const ModelSelector = forwardRef<ModelSelectorHandle, ModelSelectorProps>(
  function ModelSelector(
    {
      value,
      onChange,
      includeAuto = true,
      excludedModelIds = [],
      emptyLabel,
      menuPlacement = 'auto',
    },
    ref,
  ) {
    const shouldReduce = useReducedMotion()
    const [open, setOpen] = useState(false)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
    const selectedItemRef = useRef<HTMLButtonElement | null>(null)
    const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>('bottom')
    const [alignEnd, setAlignEnd] = useState(false)
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

    const fuse = useMemo(
      () =>
        new Fuse(models, {
          keys: [
            { name: 'name', weight: 0.6 },
            { name: 'id', weight: 0.3 },
            { name: 'provider', weight: 0.1 },
          ],
          threshold: 0.4,
          includeScore: false,
          ignoreLocation: true,
        }),
      [models],
    )

    const filteredModels = useMemo(() => {
      const exclusion = new Set(excludedModelIds)
      const baseCandidates = searchQuery ? fuse.search(searchQuery).map((r) => r.item) : models
      const base = baseCandidates.filter((model) => !exclusion.has(model.id))
      if (!value || searchQuery) return base
      const idx = base.findIndex((m) => m.id === value)
      if (idx <= 0) return base
      const selected = base[idx]
      if (!selected) return base
      return [selected, ...base.slice(0, idx), ...base.slice(idx + 1)]
    }, [excludedModelIds, fuse, models, searchQuery, value])

    // Flat ordered list for keyboard navigation: Auto at index 0, then all filtered models
    const flatItems = useMemo(
      () =>
        includeAuto
          ? [undefined as string | undefined, ...filteredModels.map((m) => m.id)]
          : filteredModels.map((m) => m.id),
      [filteredModels, includeAuto],
    )

    // Pre-computed global nav index for each model (Auto occupies index 0)
    const modelIndexMap = useMemo(() => {
      const map = new Map<string, number>()
      const offset = includeAuto ? 1 : 0
      filteredModels.forEach((m, i) => map.set(m.id, i + offset))
      return map
    }, [filteredModels, includeAuto])

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

    // Scroll to selected model when dropdown opens
    useEffect(() => {
      if (!open) return
      requestAnimationFrame(() => {
        selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
      })
    }, [open])

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

    useEffect(() => {
      if (!open) return

      const measure = () => {
        const triggerEl = triggerRef.current
        if (!triggerEl) return
        const triggerRect = triggerEl.getBoundingClientRect()
        const menuHeight = menuRef.current?.offsetHeight ?? UX.MODEL_MENU_FALLBACK_HEIGHT
        const menuWidth = menuRef.current?.offsetWidth ?? UX.MODEL_MENU_FALLBACK_WIDTH
        const spaceAbove = triggerRect.top
        const spaceBelow = window.innerHeight - triggerRect.bottom

        if (menuPlacement === 'top') {
          setResolvedPlacement('top')
        } else if (menuPlacement === 'bottom') {
          setResolvedPlacement('bottom')
        } else {
          const shouldOpenBelow =
            spaceBelow >= menuHeight || (spaceBelow > 120 && spaceBelow >= spaceAbove)
          setResolvedPlacement(shouldOpenBelow ? 'bottom' : 'top')
        }

        setAlignEnd(triggerRect.left + menuWidth > window.innerWidth - LIMITS.DROPDOWN_EDGE_GUTTER)
      }

      measure()
      window.addEventListener('resize', measure)
      window.addEventListener('scroll', measure, true)
      return () => {
        window.removeEventListener('resize', measure)
        window.removeEventListener('scroll', measure, true)
      }
    }, [menuPlacement, open])

    return (
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={
            value
              ? `Model: ${selected?.name ?? value}`
              : includeAuto
                ? 'Model: Auto'
                : 'Model: none selected'
          }
          className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-(--text-muted) transition-colors hover:bg-(--bg-surface-hover) hover:text-(--text-secondary)"
        >
          {value ? (
            <>
              <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
              <span className="max-w-28 truncate font-mono">{selected?.name ?? value}</span>
            </>
          ) : (
            <>
              {includeAuto ? <Sparkles className="size-3" /> : null}
              <span>{includeAuto ? 'Auto' : (emptyLabel ?? 'Select model')}</span>
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
              ref={menuRef}
              role="listbox"
              aria-label="Select model"
              className={cn(
                'absolute z-50 flex max-h-80 w-88 flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-glass-strong) shadow-xl shadow-black/30 backdrop-blur-3xl',
                resolvedPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
                alignEnd ? 'right-0' : 'left-0',
              )}
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
                    placeholder={UI_TEXT.MODEL_SEARCH_PLACEHOLDER}
                    className="w-full rounded-md bg-(--bg-surface) py-1.5 pl-8 pr-3 text-sm text-(--text-primary) placeholder:text-(--text-ghost) outline-none border border-transparent focus:border-(--border-default) focus:ring-1 focus:ring-(--accent-muted)"
                    // Prevent closing on space bar when searching
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div className="overflow-y-auto p-1">
                {includeAuto && (!searchQuery || 'auto'.includes(searchQuery.toLowerCase())) && (
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

                {includeAuto && <div className="mx-1 border-t border-(--border-subtle)" />}

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
                      const isSelected = value === m.id
                      return (
                        <button
                          key={m.id}
                          ref={(el) => {
                            itemRefs.current[idx] = el
                            if (isSelected) selectedItemRef.current = el
                          }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={focusedIndex === idx ? 0 : -1}
                          onClick={() => handleSelect(m.id)}
                          className={cn(
                            'flex w-full min-h-10 flex-col gap-1 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-(--bg-surface-hover)',
                            isSelected && 'bg-(--accent-muted) text-accent',
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <span className="flex-1 truncate font-mono">{m.name}</span>
                            {isSelected && <Check size={12} className="shrink-0 text-(--accent)" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
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
                            <span className="text-(--text-secondary)">
                              {Math.round(m.contextWindow / LIMITS.TOKENS_PER_K)}k · $
                              {m.pricing.promptPerMillion}/M
                            </span>
                          </div>
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
