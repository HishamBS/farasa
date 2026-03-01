import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { AdapterAccountType } from '@auth/core/adapters'
import type { MessageMetadata } from '@/schemas/message'
import type { RuntimeConfigOverride } from '@/schemas/runtime-config'
import { CHAT_MODES, NEW_CHAT_TITLE } from '@/config/constants'

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', {
    withTimezone: true,
    mode: 'date',
  }),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(NEW_CHAT_TITLE),
    model: text('model'),
    isPinned: boolean('is_pinned').notNull().default(false),
    searchMode: text('search_mode').notNull().default(CHAT_MODES.CHAT),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    convUserUpdatedIdx: index('conv_user_updated_idx').on(table.userId, table.updatedAt),
  }),
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<MessageMetadata>(),
    clientRequestId: text('client_request_id'),
    streamSequenceMax: integer('stream_sequence_max'),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    msgConvCreatedIdx: index('msg_conv_created_idx').on(table.conversationId, table.createdAt),
    msgConvRequestUnique: uniqueIndex('msg_conv_request_unique').on(
      table.conversationId,
      table.role,
      table.clientRequestId,
    ),
  }),
)

export const runtimeConfigs = pgTable(
  'runtime_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope', { enum: ['system', 'tenant', 'user'] }).notNull(),
    scopeKey: text('scope_key'),
    payload: jsonb('payload').$type<RuntimeConfigOverride>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    runtimeScopeUnique: uniqueIndex('runtime_scope_unique').on(table.scope, table.scopeKey),
    runtimeScopeIdx: index('runtime_scope_idx').on(table.scope, table.scopeKey),
    runtimeScopeCheck: check(
      'runtime_scope_check',
      // system must not have scopeKey; user/tenant must have scopeKey
      // validated in DB as an invariant
      sql`((${table.scope} = 'system' AND ${table.scopeKey} IS NULL) OR (${table.scope} IN ('tenant','user') AND ${table.scopeKey} IS NOT NULL))`,
    ),
  }),
)

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('dark'),
  sidebarExpanded: boolean('sidebar_expanded').notNull().default(true),
  defaultModel: text('default_model'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, {
      onDelete: 'cascade',
    }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    storageUrl: text('storage_url').notNull(),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    attUserIdx: index('att_user_idx').on(table.userId),
    attMsgIdx: index('att_msg_idx').on(table.messageId),
  }),
)
