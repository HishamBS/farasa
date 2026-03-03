import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch {
    return Response.json(
      { status: 'degraded', db: false, timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
