import { LIMITS, MESSAGE_ROLES } from '@/config/constants'
import type { db } from '@/lib/db/client'
import { attachments, messages } from '@/lib/db/schema'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'
import type { ChatMessageContentItem, Message } from '@openrouter/sdk/models'
import {
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
} from '@openrouter/sdk/models'
import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm'

type AttachmentRow = typeof attachments.$inferSelect

function decodeDataUrlToText(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return dataUrl
  const base64 = dataUrl.slice(commaIndex + 1)
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function buildAttachmentBlocks(attachmentRows: AttachmentRow[]): ChatMessageContentItem[] {
  const blocks: ChatMessageContentItem[] = []
  for (const att of attachmentRows) {
    if (att.fileType.startsWith('text/')) {
      const decoded = decodeDataUrlToText(att.storageUrl)
      blocks.push({
        type: ChatMessageContentItemTextType.Text,
        text: `<file name="${escapeXmlForPrompt(att.fileName)}">\n${decoded}\n</file>`,
      })
    } else {
      blocks.push({
        type: ChatMessageContentItemImageType.ImageUrl,
        imageUrl: { url: att.storageUrl },
      })
    }
  }
  return blocks
}

export async function buildEnrichedHistory(
  dbClient: typeof db,
  conversationId: string,
): Promise<Message[]> {
  const historyRows = await dbClient
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        or(eq(messages.role, MESSAGE_ROLES.USER), eq(messages.role, MESSAGE_ROLES.ASSISTANT)),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(LIMITS.CONVERSATION_HISTORY_LIMIT)

  const userMessageIds = historyRows.filter((r) => r.role === MESSAGE_ROLES.USER).map((r) => r.id)

  const historyAttachmentRows =
    userMessageIds.length > 0
      ? await dbClient
          .select()
          .from(attachments)
          .where(
            and(inArray(attachments.messageId, userMessageIds), isNotNull(attachments.confirmedAt)),
          )
      : []

  const attachmentsByMessageId = new Map<string, (typeof historyAttachmentRows)[number][]>()
  for (const att of historyAttachmentRows) {
    if (!att.messageId) continue
    const existing = attachmentsByMessageId.get(att.messageId) ?? []
    existing.push(att)
    attachmentsByMessageId.set(att.messageId, existing)
  }

  return historyRows.map((row) => {
    if (row.role === MESSAGE_ROLES.USER) {
      const rowAttachments = attachmentsByMessageId.get(row.id)
      if (rowAttachments && rowAttachments.length > 0) {
        const blocks: ChatMessageContentItem[] = [
          { type: ChatMessageContentItemTextType.Text, text: row.content },
          ...buildAttachmentBlocks(rowAttachments),
        ]
        return { role: row.role, content: blocks }
      }
      return { role: row.role, content: row.content }
    }

    let enrichedContent = row.content
    const meta = row.metadata

    if (meta?.searchQuery && meta?.searchResults?.length) {
      enrichedContent = `[This response used web search for: "${meta.searchQuery}"]\n${enrichedContent}`
    }
    if (meta?.teamId && meta?.modelUsed && !meta?.isTeamSynthesis) {
      enrichedContent = `[Response from: ${meta.modelUsed}]\n${enrichedContent}`
    }
    if (meta?.isTeamSynthesis && meta?.modelUsed) {
      enrichedContent = `[Synthesis by: ${meta.modelUsed}]\n${enrichedContent}`
    }

    return { role: row.role, content: enrichedContent }
  })
}
