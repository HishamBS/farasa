import { redirect } from 'next/navigation'
import { ROUTES } from '@/config/routes'

export default function ProtectedRootPage() {
  redirect(ROUTES.CHAT)
}
