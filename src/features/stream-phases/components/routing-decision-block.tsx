'use client'

import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  FACTOR_GROUPS,
  PROVIDER_ALIASES,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_DOT_CLASSES,
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

const STEP_REVEAL = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2 },
}

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

function StepConnector({ shouldReduce }: { shouldReduce: boolean | null }) {
  return (
    <motion.div
      className="mt-2.5 hidden h-px flex-1 bg-(--accent)/20 sm:block"
      initial={shouldReduce ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={shouldReduce ? undefined : { duration: 0.3 }}
    />
  )
}

function HorizontalStep({
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
      className="min-w-0 flex-1"
      initial={shouldReduce ? false : STEP_REVEAL.initial}
      animate={STEP_REVEAL.animate}
      transition={shouldReduce ? undefined : { ...STEP_REVEAL.transition, delay }}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 ring-1 ring-(--accent)/30">
          <Icon size={10} className="text-(--accent)" />
        </div>
        <span className="text-[0.6875rem] font-medium text-(--text-secondary)">{label}</span>
      </div>
      <div className="mt-1.5 pl-6.5">{children}</div>
    </motion.div>
  )
}

function ResultBadge({
  modelLabel,
  provider,
  shouldReduce,
}: {
  modelLabel: string
  provider: string | null
  shouldReduce: boolean | null
}) {
  const dotClass = provider ? PROVIDER_DOT_CLASSES[provider] : undefined
  const displayName = provider ? PROVIDER_DISPLAY_NAMES[provider] : undefined

  return (
    <motion.div
      className="min-w-0 flex-1"
      initial={shouldReduce ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldReduce ? undefined : { duration: 0.2, delay: 0.25 }}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--accent)/15 ring-1 ring-(--accent)/30">
          <CheckCircle size={10} className="text-(--accent)" />
        </div>
        <span className="text-[0.6875rem] font-medium text-(--text-secondary)">Result</span>
      </div>
      <div className="mt-1.5 pl-6.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-(--accent)/25 bg-(--accent)/8 px-2.5 py-1 text-xs">
          <span className={cn('size-1.5 rounded-full', dotClass ?? 'bg-(--accent)')} />
          <span className="font-medium text-(--text-primary)">{modelLabel}</span>
          <CheckCircle size={11} className="text-(--accent)" />
        </span>
        {displayName && (
          <span className="mt-0.5 block text-[0.6rem] text-(--text-muted)">by {displayName}</span>
        )}
      </div>
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

  const CategoryBadgeIcon = useMemo(() => {
    if (!category) return null
    const iconName = CATEGORY_ICONS[category]
    return CATEGORY_ICON_COMPONENTS[iconName] ?? null
  }, [category])

  const analyzeFactors = useMemo(() => {
    const taskFactors = grouped.task ?? []
    const capabilityFactors = grouped.capability ?? []
    return [...taskFactors, ...capabilityFactors]
  }, [grouped])

  const matchFactors = useMemo(() => {
    const modelFactors = grouped.model ?? []
    const responseFactors = grouped.response ?? []
    return [...modelFactors, ...responseFactors]
  }, [grouped])

  const hasAnalyze = category || analyzeFactors.length > 0
  const hasMatch = typeof confidence === 'number' || matchFactors.length > 0

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
          <motion.div key="steps" {...(shouldReduce ? {} : expand)} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
              {hasAnalyze && (
                <>
                  <HorizontalStep
                    icon={Search}
                    label="Analyze"
                    shouldReduce={shouldReduce}
                    delay={0}
                  >
                    <div className="flex flex-wrap gap-1">
                      {category && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-(--routing-mode-border) bg-(--routing-mode-bg) px-2 py-0.5 text-[0.625rem] text-(--routing-mode)">
                          {CategoryBadgeIcon && <CategoryBadgeIcon size={9} />}
                          {CATEGORY_LABELS[category]}
                        </span>
                      )}
                      {analyzeFactors.map((f) => (
                        <span
                          key={f.key}
                          className="inline-flex items-center gap-1 rounded-full border border-(--routing-tool-border) bg-(--routing-tool-bg) px-2 py-0.5 text-[0.625rem] text-(--routing-tool)"
                        >
                          {f.value}
                        </span>
                      ))}
                    </div>
                  </HorizontalStep>
                  <StepConnector shouldReduce={shouldReduce} />
                </>
              )}

              {hasMatch && (
                <>
                  <HorizontalStep
                    icon={Sparkles}
                    label="Match"
                    shouldReduce={shouldReduce}
                    delay={0.12}
                  >
                    <div className="flex flex-wrap gap-1">
                      {matchFactors.map((f) => (
                        <span
                          key={f.key}
                          className="text-[0.625rem] leading-relaxed text-(--text-muted)"
                        >
                          {f.value}
                        </span>
                      ))}
                    </div>
                  </HorizontalStep>
                  <StepConnector shouldReduce={shouldReduce} />
                </>
              )}

              <ResultBadge
                modelLabel={modelLabel}
                provider={provider}
                shouldReduce={shouldReduce}
              />
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
