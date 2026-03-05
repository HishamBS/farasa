import { LIMITS, MESSAGE_ROLES, TRPC_CODES } from '@/config/constants'
import type { db } from '@/lib/db/client'
import { attachments, messages } from '@/lib/db/schema'
import { escapeXmlForPrompt } from '@/lib/security/runtime-safety'
import { AppError } from '@/lib/utils/errors'
import type { ChatMessageContentItem, Message } from '@openrouter/sdk/models'
import {
  ChatMessageContentItemImageType,
  ChatMessageContentItemTextType,
} from '@openrouter/sdk/models'
import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { extractFileContentBlock } from './text-extraction'

export type AttachmentRow = typeof attachments.$inferSelect

async function buildAttachmentBlocks(
  attachmentRows: AttachmentRow[],
): Promise<ChatMessageContentItem[]> {
  const blocks: ChatMessageContentItem[] = []
  for (const att of attachmentRows) {
    if (att.fileType.startsWith('image/')) {
      blocks.push({
        type: ChatMessageContentItemImageType.ImageUrl,
        imageUrl: { url: att.storageUrl },
      })
    } else {
      const fileBlock = await extractFileContentBlock(att.fileName, att.fileType, att.storageUrl)
      if (fileBlock) {
        blocks.push({
          type: ChatMessageContentItemTextType.Text,
          text: fileBlock,
        })
      }
    }
  }
  return blocks
}

export async function buildUserContent(
  text: string,
  attachmentRows: AttachmentRow[],
): Promise<string | ChatMessageContentItem[]> {
  if (attachmentRows.length === 0) return text
  return [
    { type: ChatMessageContentItemTextType.Text, text },
    ...(await buildAttachmentBlocks(attachmentRows)),
  ]
}

export async function linkAttachmentsToMessage(
  dbClient: typeof db,
  userId: string,
  attachmentIds: string[],
  messageId: string,
): Promise<AttachmentRow[]> {
  const uniqueIds = [...new Set(attachmentIds)]
  if (uniqueIds.length === 0) return []

  for (let attempt = 0; attempt < LIMITS.ATTACHMENT_LINK_MAX_RETRIES; attempt++) {
    const linked = await dbClient
      .update(attachments)
      .set({ messageId })
      .where(
        and(
          inArray(attachments.id, uniqueIds),
          eq(attachments.userId, userId),
          isNotNull(attachments.confirmedAt),
          or(isNull(attachments.messageId), eq(attachments.messageId, messageId)),
        ),
      )
      .returning()

    if (linked.length === uniqueIds.length) return linked

    if (attempt < LIMITS.ATTACHMENT_LINK_MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, LIMITS.ATTACHMENT_LINK_RETRY_DELAY_MS))
    }
  }

  throw new TRPCError({
    code: TRPC_CODES.FORBIDDEN,
    message: AppError.ATTACHMENT_ACCESS_DENIED,
  })
}

async function buildHistoryAttachmentContent(
  rows: { fileName: string; fileType: string; storageUrl: string }[],
): Promise<ChatMessageContentItem[]> {
  const blocks: ChatMessageContentItem[] = []
  for (const att of rows) {
    if (att.fileType.startsWith('image/')) {
      blocks.push({
        type: ChatMessageContentItemImageType.ImageUrl,
        imageUrl: { url: att.storageUrl },
      })
    } else {
      try {
        const fileBlock = await extractFileContentBlock(att.fileName, att.fileType, att.storageUrl)
        if (fileBlock) {
          blocks.push({
            type: ChatMessageContentItemTextType.Text,
            text: fileBlock,
          })
        }
      } catch (err) {
        console.error(
          `[history-builder] Failed to extract ${att.fileName}:`,
          err instanceof Error ? err.message : err,
        )
        blocks.push({
          type: ChatMessageContentItemTextType.Text,
          text: `<file name="${escapeXmlForPrompt(att.fileName)}">[Content extraction failed]</file>`,
        })
      }
    }
  }
  return blocks
}

export async function buildEnrichedHistory(
  dbClient: typeof db,
  conversationId: string,
  options?: {
    excludeMessageIds?: string[]
  },
): Promise<Message[]> {
  const excludedMessageIds = new Set(options?.excludeMessageIds ?? [])

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
          .select({
            id: attachments.id,
            messageId: attachments.messageId,
            fileName: attachments.fileName,
            fileType: attachments.fileType,
            storageUrl: attachments.storageUrl,
          })
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

  // Group team assistant messages by teamId so we can filter to synthesis-only
  const teamMessagesByTeamId = new Map<string, typeof historyRows>()
  for (const row of historyRows) {
    const teamId = row.metadata?.teamId
    if (row.role === MESSAGE_ROLES.ASSISTANT && typeof teamId === 'string') {
      const group = teamMessagesByTeamId.get(teamId) ?? []
      group.push(row)
      teamMessagesByTeamId.set(teamId, group)
    }
  }

  // For each team group, determine which message to keep (synthesis or first response)
  const includedTeamMessageIds = new Set<string>()
  for (const [, group] of teamMessagesByTeamId) {
    const synthesis = group.find((r) => r.metadata?.isTeamSynthesis === true)
    const representative = synthesis ?? group[0]
    if (representative) {
      includedTeamMessageIds.add(representative.id)
    }
  }

  const enrichedRows: Message[] = []
  for (const row of historyRows) {
    if (excludedMessageIds.has(row.id)) continue

    // Skip non-representative team assistant messages to prevent context bloat
    const teamId = row.metadata?.teamId
    if (
      row.role === MESSAGE_ROLES.ASSISTANT &&
      typeof teamId === 'string' &&
      !includedTeamMessageIds.has(row.id)
    ) {
      continue
    }

    if (row.role === MESSAGE_ROLES.USER) {
      const rowAttachments = attachmentsByMessageId.get(row.id)
      if (rowAttachments && rowAttachments.length > 0) {
        const attachmentBlocks = await buildHistoryAttachmentContent(rowAttachments)
        if (attachmentBlocks.length > 0) {
          enrichedRows.push({
            role: row.role,
            content: [
              { type: ChatMessageContentItemTextType.Text, text: row.content },
              ...attachmentBlocks,
            ],
          })
          continue
        }
      }
      enrichedRows.push({ role: row.role, content: row.content })
      continue
    }

    let enrichedContent = row.content
    const meta = row.metadata

    if (meta?.searchQuery && meta?.searchResults?.length) {
      const safeQuery = escapeXmlForPrompt(meta.searchQuery)
      enrichedContent = `[This response used web search for: "${safeQuery}"]\n${enrichedContent}`
    }
    if (meta?.teamId && meta?.modelUsed) {
      const safeModel = escapeXmlForPrompt(meta.modelUsed)
      const label = meta.isTeamSynthesis ? 'Synthesis by' : 'Response from'
      enrichedContent = `[${label}: ${safeModel}]\n${enrichedContent}`
    }

    enrichedRows.push({ role: row.role, content: enrichedContent })
  }

  return enrichedRows
}
