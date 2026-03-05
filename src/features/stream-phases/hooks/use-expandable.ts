import { useCallback, useEffect, useRef, useState } from 'react'

type UseExpandableOptions = {
  defaultExpanded?: boolean
  controlledExpanded?: boolean
  controlledToggle?: () => void
  autoCollapse?: boolean
}

type UseExpandableReturn = {
  isExpanded: boolean
  toggle: () => void
}

export function useExpandable({
  defaultExpanded = false,
  controlledExpanded,
  controlledToggle,
  autoCollapse,
}: UseExpandableOptions): UseExpandableReturn {
  const isControlled = controlledExpanded !== undefined
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = isControlled ? controlledExpanded : internalExpanded
  const prevAutoCollapseRef = useRef(autoCollapse)

  useEffect(() => {
    const wasCollapsed = !prevAutoCollapseRef.current
    prevAutoCollapseRef.current = autoCollapse
    if (!isControlled && wasCollapsed && autoCollapse) {
      setInternalExpanded(false)
    }
  }, [autoCollapse, isControlled])

  const toggle = useCallback(() => {
    if (controlledToggle) {
      controlledToggle()
    } else {
      setInternalExpanded((prev) => !prev)
    }
  }, [controlledToggle])

  return { isExpanded, toggle }
}
