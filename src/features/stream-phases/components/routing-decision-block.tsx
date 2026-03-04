'use client'

import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FACTOR_GROUPS,
  PROVIDER_ALIASES,
  PROVIDER_CARD_CLASSES,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_DOT_CLASSES,
  STREAM_PHASES,
  STREAM_PROGRESS,
  TIMELINE_DISPLAY_ORDER,
} from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { resolveProviderKey } from '@/lib/utils/model'
import { expand, fadeIn, scaleIn, timelineNodeReveal, timelineStagger } from '@/lib/utils/motion'
import type { ModelCapability, RouterFactor } from '@/schemas/model'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Brain,
  CheckCircle,
  ChevronDown,
  Code,
  Cpu,
  Eye,
  FileText,
  Globe,
  Image,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type RoutingDecisionBlockProps = {
  modelLabel: string
  model?: string
  category?: ModelCapability
  confidence?: number
  reasoning?: string
  factors?: RouterFactor[]
  defaultExpanded?: boolean
  compact?: boolean
  autoCollapse?: boolean
  className?: string
}

type FactorGroupId = (typeof FACTOR_GROUPS)[number]['id']
type GroupedFactors = Partial<Record<FactorGroupId, RouterFactor[]>>

const CATEGORY_ICON_COMPONENTS: Record<string, LucideIcon> = {
  Code,
  Brain,
  Sparkles,
  Eye,
  Image,
  Globe,
  Zap,
}

const DEFAULT_GROUP_ICONS: Record<FactorGroupId, LucideIcon> = {
  task: Sparkles,
  capability: ShieldCheck,
  model: Cpu,
  response: FileText,
  selection: CheckCircle,
}

const GROUP_BADGE_CLASSES: Record<FactorGroupId, string> = {
  task: 'border-(--routing-mode-border) bg-(--routing-mode-bg) text-(--routing-mode)',
  capability: 'border-(--routing-tool-border) bg-(--routing-tool-bg) text-(--routing-tool)',
  model: 'border-(--routing-model-border) bg-(--routing-model-bg) text-(--routing-model)',
  response:
    'border-(--routing-response-border) bg-(--routing-response-bg) text-(--routing-response)',
  selection: 'border-(--routing-source-border) bg-(--routing-source-bg) text-(--routing-source)',
}

const STEP_COUNT = 3

function groupFactors(factors: RouterFactor[]): GroupedFactors {
  const result: GroupedFactors = {}
  for (const factor of factors) {
    for (const group of FACTOR_GROUPS) {
      if (group.patterns.some((pattern) => factor.key.includes(pattern))) {
        const existing = result[group.id]
        if (existing) {
          existing.push(factor)
        } else {
          result[group.id] = [factor]
        }
        break
      }
    }
  }
  return result
}

function StepDots({ shouldReduce }: { shouldReduce: boolean | null }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-1"
          initial={shouldReduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={shouldReduce ? undefined : { delay: i * 0.12, duration: 0.25 }}
        >
          <div className="flex size-3.5 items-center justify-center rounded-full bg-(--accent)/20">
            <CheckCircle size={8} className="text-(--accent)" />
          </div>
          {i < STEP_COUNT - 1 && <div className="h-px w-2 bg-(--accent)/30" />}
        </motion.div>
      ))}
    </div>
  )
}

function TimelineNode({
  label,
  icon: Icon,
  isLast,
  shouldReduce,
  children,
}: {
  label: string
  icon: LucideIcon
  isLast: boolean
  shouldReduce: boolean | null
  children: ReactNode
}) {
  return (
    <motion.div className="flex gap-3" {...(shouldReduce ? {} : timelineNodeReveal)}>
      <div className="flex shrink-0 flex-col items-center">
        <div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-(--accent)/15 ring-1 ring-(--accent)/30">
          <Icon size={10} className="text-(--accent)" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-(--accent)/15" />}
      </div>
      <div className={cn('min-w-0 flex-1', !isLast && 'pb-3')}>
        <span className="text-xs font-medium text-(--text-secondary)">{label}</span>
        <div className="mt-1.5">{children}</div>
      </div>
    </motion.div>
  )
}

function FinalSelectionCard({
  modelLabel,
  provider,
  shouldReduce,
}: {
  modelLabel: string
  provider: string | null
  shouldReduce: boolean | null
}) {
  const cardClass = provider ? PROVIDER_CARD_CLASSES[provider] : undefined
  const dotClass = provider ? PROVIDER_DOT_CLASSES[provider] : undefined
  const displayName = provider ? PROVIDER_DISPLAY_NAMES[provider] : undefined

  return (
    <motion.div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        cardClass ?? 'border-(--border-subtle) bg-(--bg-surface)',
      )}
      {...(shouldReduce ? {} : scaleIn)}
    >
      <div className="flex items-center gap-2">
        <span className={cn('size-2 rounded-full', dotClass ?? 'bg-(--accent)')} />
        <span className="text-sm font-medium text-(--text-primary)">{modelLabel}</span>
        <CheckCircle size={14} className="text-(--accent)" />
      </div>
      {displayName && (
        <span className="mt-0.5 block pl-4 text-[0.625rem] text-(--text-muted)">
          by {displayName}
        </span>
      )}
    </motion.div>
  )
}

export function RoutingDecisionBlock({
  modelLabel,
  model,
  category,
  confidence,
  reasoning,
  factors,
  defaultExpanded = true,
  compact = false,
  autoCollapse,
  className,
}: RoutingDecisionBlockProps) {
  const shouldReduce = useReducedMotion()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const toggle = useCallback(() => setIsExpanded((prev) => !prev), [])

  useEffect(() => {
    if (autoCollapse && isExpanded) {
      setIsExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to autoCollapse transitions
  }, [autoCollapse])

  const provider = useMemo(
    () => (model ? resolveProviderKey(model, PROVIDER_ALIASES) : null),
    [model],
  )

  const grouped = useMemo(() => groupFactors(factors ?? []), [factors])

  const activeNodes = useMemo(() => {
    const nodes: FactorGroupId[] = []
    for (const id of TIMELINE_DISPLAY_ORDER) {
      const hasFactors = (grouped[id]?.length ?? 0) > 0
      switch (id) {
        case 'task':
          if (category || hasFactors) nodes.push(id)
          break
        case 'model':
          if (typeof confidence === 'number' || hasFactors) nodes.push(id)
          break
        case 'selection':
          nodes.push(id)
          break
        default:
          if (hasFactors) nodes.push(id)
      }
    }
    return nodes
  }, [grouped, category, confidence])

  const CategoryBadgeIcon = useMemo(() => {
    if (!category) return null
    const iconName = CATEGORY_ICONS[category]
    return CATEGORY_ICON_COMPONENTS[iconName] ?? null
  }, [category])

  const providerDotClass = provider ? PROVIDER_DOT_CLASSES[provider] : undefined

  return (
    <div className={cn('mb-3', className)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-xl border border-(--accent)/35 bg-(--accent)/8 px-2.5 py-1.5 transition-all duration-200 active:scale-[0.98]',
          compact
            ? 'hover:scale-105 hover:border-(--accent)/55'
            : 'hover:scale-[1.02] hover:border-(--accent)/50',
        )}
        aria-expanded={isExpanded}
      >
        <span className={cn('size-1.5 rounded-full', providerDotClass ?? 'bg-(--accent)')} />
        <span className="text-sm font-medium text-(--accent)">
          {STREAM_PROGRESS.LABELS[STREAM_PHASES.ROUTING]}
        </span>
        {!compact && (
          <span className="max-w-36 truncate text-xs text-(--text-secondary)">{modelLabel}</span>
        )}
        {!compact && <StepDots shouldReduce={shouldReduce} />}
        <ChevronDown
          size={13}
          className={cn('text-(--text-muted) transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div key="timeline" {...(shouldReduce ? {} : expand)} className="overflow-hidden">
            <div className="mt-3">
              <motion.div {...(shouldReduce ? {} : timelineStagger)}>
                {activeNodes.map((groupId, index) => {
                  const group = FACTOR_GROUPS.find((g) => g.id === groupId)
                  if (!group) return null
                  const nodeFactors = grouped[groupId]
                  const isLast = index === activeNodes.length - 1
                  const NodeIcon = DEFAULT_GROUP_ICONS[groupId]

                  return (
                    <TimelineNode
                      key={groupId}
                      label={group.label}
                      icon={NodeIcon}
                      isLast={isLast}
                      shouldReduce={shouldReduce}
                    >
                      {groupId === 'task' && (
                        <div className="space-y-1.5">
                          {category && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem]',
                                GROUP_BADGE_CLASSES.task,
                              )}
                            >
                              {CategoryBadgeIcon && <CategoryBadgeIcon size={10} />}
                              {CATEGORY_LABELS[category]}
                            </span>
                          )}
                          {nodeFactors?.map((f) => (
                            <p key={f.key} className="text-xs text-(--text-muted)">
                              {f.value}
                            </p>
                          ))}
                        </div>
                      )}

                      {groupId === 'capability' && (
                        <div className="space-y-1">
                          {nodeFactors?.map((f) => (
                            <div
                              key={f.key}
                              className="flex items-center gap-1.5 text-xs text-(--text-muted)"
                            >
                              <ShieldCheck size={11} className="shrink-0 text-(--routing-tool)" />
                              {f.value}
                            </div>
                          ))}
                        </div>
                      )}

                      {groupId === 'model' && (
                        <div className="space-y-1.5">
                          {nodeFactors?.map((f) => (
                            <p key={f.key} className="text-xs text-(--text-muted)">
                              {f.value}
                            </p>
                          ))}
                        </div>
                      )}

                      {groupId === 'response' && (
                        <div className="flex flex-wrap gap-1.5">
                          {nodeFactors?.map((f) => (
                            <span
                              key={f.key}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem]',
                                GROUP_BADGE_CLASSES.response,
                              )}
                            >
                              <FileText size={10} />
                              {f.value}
                            </span>
                          ))}
                        </div>
                      )}

                      {groupId === 'selection' && (
                        <FinalSelectionCard
                          modelLabel={modelLabel}
                          provider={provider}
                          shouldReduce={shouldReduce}
                        />
                      )}
                    </TimelineNode>
                  )
                })}
              </motion.div>

              {reasoning && (
                <motion.p
                  {...(shouldReduce ? {} : fadeIn)}
                  className="mt-3 rounded-lg border border-(--routing-reasoning-border) bg-(--routing-reasoning-bg) px-3 py-2.5 text-xs leading-relaxed text-(--routing-reasoning)"
                >
                  {reasoning}
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
