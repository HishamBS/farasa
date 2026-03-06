'use client'

import { useCallback, useState } from 'react'
import { useDataBinding, useDataModelContext } from '@a2ui-sdk/react/0.8'
import type { BaseComponentProps } from '../types'
import type { SliderComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource, extractLiteralDefault } from '../normalize-value-source'

export function SliderAdapter({
  surfaceId,
  componentId,
  label,
  value,
  minValue = 0,
  maxValue = 100,
}: BaseComponentProps & SliderComponentProps) {
  const safeLabel = normalizeValueSource(label)
  const resolvedLabel = useDataBinding<string>(surfaceId, safeLabel, '')
  const { setDataValue } = useDataModelContext()
  const initialValue = extractLiteralDefault(normalizeValueSource(value), minValue)
  const [current, setCurrent] = useState(initialValue)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value)
      setCurrent(newValue)
      setDataValue(surfaceId, `/${componentId}`, newValue)
    },
    [setDataValue, surfaceId, componentId],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {resolvedLabel && (
          <label className="text-sm font-medium text-(--text-secondary)">{resolvedLabel}</label>
        )}
        <span className="min-w-[2.5rem] text-right text-sm font-semibold tabular-nums text-(--accent)">
          {current}
        </span>
      </div>
      <input
        type="range"
        min={minValue}
        max={maxValue}
        value={current}
        onChange={handleChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-(--border-default) accent-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/30 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--accent) [&::-webkit-slider-thumb]:shadow-md"
      />
      <div className="flex justify-between text-xs text-(--text-ghost)">
        <span>{minValue}</span>
        <span>{maxValue}</span>
      </div>
    </div>
  )
}
