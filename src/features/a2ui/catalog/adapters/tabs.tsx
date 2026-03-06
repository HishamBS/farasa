'use client'

import { useState, useCallback } from 'react'
import { ComponentRenderer, useDataBinding } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { TabsComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import type { ValueSource } from '@a2ui-sdk/types/0.8'
import { normalizeValueSource } from '../normalize-value-source'
import { cn } from '@/lib/utils/cn'

export function TabsAdapter({ surfaceId, tabItems }: BaseComponentProps & TabsComponentProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const handleSelect = useCallback((index: number) => setActiveIndex(index), [])

  if (!tabItems || tabItems.length === 0) return null

  const activeTab = tabItems[activeIndex]

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-(--border-default)">
      <div
        className="flex border-b border-(--border-subtle) bg-(--bg-surface-hover)/40"
        role="tablist"
      >
        {tabItems.map((tab, index) => (
          <TabTrigger
            key={index}
            surfaceId={surfaceId}
            title={tab.title}
            isActive={index === activeIndex}
            onClick={() => handleSelect(index)}
          />
        ))}
      </div>
      <div className="p-3" role="tabpanel">
        {activeTab?.child && (
          <ComponentRenderer surfaceId={surfaceId} componentId={activeTab.child} />
        )}
      </div>
    </div>
  )
}

function TabTrigger({
  surfaceId,
  title,
  isActive,
  onClick,
}: {
  surfaceId: string
  title: ValueSource | undefined
  isActive: boolean
  onClick: () => void
}) {
  const safeTitle = normalizeValueSource(title)
  const resolvedTitle = useDataBinding<string>(surfaceId, safeTitle, 'Tab')

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'border-b-2 border-(--accent) text-(--text-primary)'
          : 'text-(--text-muted) hover:text-(--text-secondary)',
      )}
    >
      {resolvedTitle}
    </button>
  )
}
