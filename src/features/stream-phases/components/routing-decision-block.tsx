'use client'

import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FACTOR_GROUPS,
  PROVIDER_ALIASES,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_DOT_CLASSES,
  MOTION,
  ROUTING_PHASE_FALLBACKS,
  ROUTING_PHASE_LABELS,
  STREAM_PHASES,
  STREAM_PROGRESS,
} from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { resolveProviderKey } from '@/lib/utils/model'
import { expand, fadeIn } from '@/lib/utils/motion'
import type { ModelCapability, RouterFactor } from '@/schemas/model'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Brain,
  CheckCircle,
  ChevronDown,
  Code,
  Eye,
  Globe,
  Image,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  isExpanded?: boolean
  onToggle?: () => void
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
          transition={
            shouldReduce
              ? undefined
              : { delay: i * MOTION.STAGGER_DOTS, duration: MOTION.DURATION_MEDIUM }
          }
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

function PhaseStep({
  icon: Icon,
  label,
  shouldReduce,
  delay,
  children,
}: {
  icon: LucideIcon
  label: string
  shouldReduce: boolean | null
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      className="flex min-w-0 flex-1 flex-col items-center text-center"
      initial={shouldReduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduce ? undefined : { duration: MOTION.DURATION_NORMAL, delay }}
    >
      <div className="flex size-6 items-center justify-center rounded-full bg-(--accent)/12 ring-1 ring-(--accent)/25">
        <Icon size={11} className="text-(--accent)" />
      </div>
      <span className="mt-1 text-[0.625rem] font-medium text-(--text-muted)">{label}</span>
      <div className="mt-1.5 w-full">{children}</div>
    </motion.div>
  )
}

function StepLine({ shouldReduce }: { shouldReduce: boolean | null }) {
  return (
    <motion.div
      className="mt-3 h-px w-6 shrink-0 bg-(--accent)/20 sm:w-8"
      initial={shouldReduce ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={shouldReduce ? undefined : { duration: MOTION.DURATION_MEDIUM }}
    />
  )
}

export function RoutingDecisionBlock({
  modelLabel,
  model,
  category,
  reasoning,
  factors,
  defaultExpanded = true,
  compact = false,
  autoCollapse,
  isExpanded: controlledExpanded,
  onToggle: controlledToggle,
  className,
}: RoutingDecisionBlockProps) {
  const shouldReduce = useReducedMotion()
  const isControlled = controlledExpanded !== undefined
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = isControlled ? controlledExpanded : internalExpanded
  const toggle = useCallback(() => {
    if (controlledToggle) {
      controlledToggle()
    } else {
      setInternalExpanded((prev) => !prev)
    }
  }, [controlledToggle])

  useEffect(() => {
    if (!isControlled && autoCollapse && internalExpanded) {
      setInternalExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to autoCollapse transitions
  }, [autoCollapse])

  const provider = useMemo(
    () => (model ? resolveProviderKey(model, PROVIDER_ALIASES) : null),
    [model],
  )

  const grouped = useMemo(() => groupFactors(factors ?? []), [factors])

  const CategoryBadgeIcon = useMemo(() => {
    if (!category) return null
    const iconName = CATEGORY_ICONS[category]
    return CATEGORY_ICON_COMPONENTS[iconName] ?? null
  }, [category])

  const matchSummary = useMemo(() => {
    const modelFactors = grouped.model ?? []
    const first = modelFactors[0]
    return first?.value ?? null
  }, [grouped])

  const providerDotClass = provider ? PROVIDER_DOT_CLASSES[provider] : undefined
  const displayName = provider ? PROVIDER_DISPLAY_NAMES[provider] : undefined

  return (
    <div className={cn('mb-3 w-fit', className)}>
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
          <motion.div key="steps" {...(shouldReduce ? {} : expand)} className="overflow-hidden">
            <div className="mt-3 flex items-start justify-center gap-0">
              <PhaseStep
                icon={Search}
                label={ROUTING_PHASE_LABELS.ANALYZE}
                shouldReduce={shouldReduce}
                delay={0}
              >
                {category ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-(--routing-mode-border) bg-(--routing-mode-bg) px-2 py-0.5 text-[0.625rem] text-(--routing-mode)">
                    {CategoryBadgeIcon && <CategoryBadgeIcon size={9} />}
                    {CATEGORY_LABELS[category]}
                  </span>
                ) : (
                  <span className="text-[0.625rem] text-(--text-muted)">
                    {ROUTING_PHASE_FALLBACKS.ANALYZED}
                  </span>
                )}
              </PhaseStep>

              <StepLine shouldReduce={shouldReduce} />

              <PhaseStep
                icon={Sparkles}
                label={ROUTING_PHASE_LABELS.MATCH}
                shouldReduce={shouldReduce}
                delay={MOTION.EXPLORE_REVEAL_DELAY}
              >
                {matchSummary ? (
                  <p className="line-clamp-2 text-[0.625rem] leading-relaxed text-(--text-secondary)">
                    {matchSummary}
                  </p>
                ) : (
                  <span className="text-[0.625rem] text-(--text-muted)">
                    {ROUTING_PHASE_FALLBACKS.MATCHED}
                  </span>
                )}
              </PhaseStep>

              <StepLine shouldReduce={shouldReduce} />

              <PhaseStep
                icon={CheckCircle}
                label={ROUTING_PHASE_LABELS.RESULT}
                shouldReduce={shouldReduce}
                delay={MOTION.EXPLORE_REVEAL_DELAY * 2}
              >
                <span className="inline-flex items-center gap-1 rounded-full border border-(--accent)/25 bg-(--accent)/8 px-2 py-0.5 text-[0.625rem]">
                  <span
                    className={cn('size-1.5 rounded-full', providerDotClass ?? 'bg-(--accent)')}
                  />
                  <span className="font-medium text-(--text-primary)">{modelLabel}</span>
                  <CheckCircle size={10} className="text-(--accent)" />
                </span>
                {displayName && (
                  <span className="mt-0.5 block text-[0.5625rem] text-(--text-muted)">
                    {displayName}
                  </span>
                )}
              </PhaseStep>
            </div>

            {reasoning && (
              <motion.p
                {...(shouldReduce ? {} : fadeIn)}
                className="mt-2.5 rounded-lg border border-(--routing-reasoning-border) bg-(--routing-reasoning-bg) px-3 py-2 text-[0.6875rem] leading-relaxed text-(--routing-reasoning)"
              >
                {reasoning}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
