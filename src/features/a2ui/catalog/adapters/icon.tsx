'use client'

import { useDataBinding } from '@a2ui-sdk/react/0.8'
import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Search,
  Home,
  Settings,
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  Star,
  Heart,
  Plus,
  Minus,
  Pencil,
  Trash2,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Circle,
  type LucideIcon,
} from 'lucide-react'
import type { BaseComponentProps } from '../types'
import type { IconComponentProps } from '@a2ui-sdk/types/0.8/standard-catalog'
import { normalizeValueSource } from '../normalize-value-source'

const ICON_MAP: Readonly<Record<string, LucideIcon>> = {
  check_circle: CheckCircle,
  check: CheckCircle,
  error: XCircle,
  close: XCircle,
  cancel: XCircle,
  info: Info,
  warning: AlertTriangle,
  search: Search,
  home: Home,
  settings: Settings,
  person: User,
  user: User,
  mail: Mail,
  email: Mail,
  phone: Phone,
  calendar: Calendar,
  clock: Clock,
  schedule: Clock,
  chevron_right: ChevronRight,
  arrow_right: ChevronRight,
  expand_more: ChevronDown,
  star: Star,
  favorite: Heart,
  add: Plus,
  remove: Minus,
  edit: Pencil,
  delete: Trash2,
  download: Download,
  upload: Upload,
  open_in_new: ExternalLink,
  content_copy: Copy,
}

export function IconAdapter({ surfaceId, name }: BaseComponentProps & IconComponentProps) {
  const safeName = normalizeValueSource(name)
  const resolvedName = useDataBinding<string>(surfaceId, safeName, '')

  if (!resolvedName) return null

  const IconComponent = ICON_MAP[resolvedName] ?? Circle

  return (
    <IconComponent
      className="size-5 text-(--text-secondary)"
      role="img"
      aria-label={resolvedName}
    />
  )
}
