'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { env } from '@/config/env'
import { COOKIE_NAMES, LIMITS } from '@/config/constants'
import { ROUTES } from '@/config/routes'

const GATE_COOKIE_MAX_AGE = LIMITS.GATE_COOKIE_MAX_AGE_SECONDS

export async function verifyAccessCode(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const code = formData.get('code')
  if (typeof code !== 'string' || !env.ACCESS_CODE || code !== env.ACCESS_CODE) {
    return { error: 'Invalid access code' }
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAMES.ACCESS_GATE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_COOKIE_MAX_AGE,
  })

  redirect(ROUTES.LOGIN)
}
