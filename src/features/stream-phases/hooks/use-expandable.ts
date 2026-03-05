import { useCallback, useEffect, useState } from 'react'

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

  useEffect(() => {
    if (!isControlled && autoCollapse && internalExpanded) {
      setInternalExpanded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to autoCollapse transitions
  }, [autoCollapse])

  const toggle = useCallback(() => {
    if (controlledToggle) {
      controlledToggle()
    } else {
      setInternalExpanded((prev) => !prev)
    }
  }, [controlledToggle])

  return { isExpanded, toggle }
}
