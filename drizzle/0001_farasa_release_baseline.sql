CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" uuid,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_url" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"model" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'chat' NOT NULL,
	"web_search_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"client_request_id" text,
	"stream_sequence_max" integer,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "runtime_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"scope_key" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"sidebar_expanded" boolean DEFAULT true NOT NULL,
	"default_model" text,
	"group_models" jsonb,
	"group_judge_model" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "att_user_idx" ON "attachments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "att_msg_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conv_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "msg_conv_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "msg_conv_request_unique" ON "messages" USING btree ("conversation_id","role","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "runtime_scope_unique" ON "runtime_configs" USING btree ("scope","scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runtime_scope_idx" ON "runtime_configs" USING btree ("scope","scope_key");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'search_mode'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'mode'
  ) THEN
    ALTER TABLE "conversations" RENAME COLUMN "search_mode" TO "mode";
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'web_search_enabled'
  ) THEN
    ALTER TABLE "conversations"
      ADD COLUMN "web_search_enabled" boolean DEFAULT false NOT NULL;
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_preferences'
      AND column_name = 'group_models'
  ) THEN
    ALTER TABLE "user_preferences" ADD COLUMN "group_models" jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_preferences'
      AND column_name = 'group_judge_model'
  ) THEN
    ALTER TABLE "user_preferences" ADD COLUMN "group_judge_model" text;
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_mode_check'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_mode_check"
      CHECK ("mode" IN ('chat', 'group'));
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'runtime_scope_check'
  ) THEN
    ALTER TABLE "runtime_configs"
      ADD CONSTRAINT "runtime_scope_check"
      CHECK (("scope" = 'system' AND "scope_key" IS NULL) OR ("scope" IN ('tenant','user') AND "scope_key" IS NOT NULL));
  END IF;
END
$$;
--> statement-breakpoint
INSERT INTO runtime_configs (scope, scope_key, payload, updated_at)
SELECT
  'system',
  NULL,
  $$
  {
    "chat": {
      "stream": {
        "maxConcurrentPerConversation": 1,
        "timeoutMs": 60000,
        "enforceSequence": true,
        "retry": {
          "maxAttempts": 2,
          "baseDelayMs": 400,
          "maxDelayMs": 2500,
          "jitterMs": 200
        }
      },
      "statusMessages": {
        "routing": "Selecting the best model for your request...",
        "thinking": "Thinking...",
        "searching": "Searching the web...",
        "readingFiles": "Processing your files...",
        "generatingUi": "Building your interface...",
        "generatingTitle": "Generating title..."
      },
      "errors": {
        "unauthorized": "Unauthorized",
        "connection": "Connection error. Please try again.",
        "processing": "An error occurred while processing your request.",
        "invalidModel": "Invalid model selection.",
        "rateLimited": "Rate limit exceeded. Please wait before trying again.",
        "providerUnavailable": "AI provider is temporarily unavailable."
      },
      "completion": {
        "invalidateOnDone": true,
        "invalidateOnError": true
      }
    },
    "models": {
      "routerModel": "google/gemini-3-flash-preview",
      "failurePolicy": "retry_then_fail",
      "strictValidation": true,
      "registry": {
        "cacheTtlMs": 3600000,
        "fetchTimeoutMs": 10000,
        "staleWhileErrorMs": 900000
      }
    },
    "prompts": {
      "routerSystem": "You are a model routing assistant. Classify intent and return JSON only.",
      "chatSystem": "You are Farasa, a concise and accurate assistant.",
      "a2uiSystem": "Use A2UI JSONL only when interactive UI materially improves the answer.",
      "titleSystem": "Generate a concise conversation title from <message> data only.",
      "wrappers": {
        "userRequestOpen": "<user_request>",
        "userRequestClose": "</user_request>",
        "messageOpen": "<message>",
        "messageClose": "</message>",
        "searchResultsOpen": "<search_results>",
        "searchResultsClose": "</search_results>",
        "searchResultOpen": "<result>",
        "searchResultClose": "</result>"
      }
    },
    "safety": {
      "escapeSearchXml": true,
      "a2ui": {
        "image": {
          "allowedProtocols": ["https", "data", "relative"],
          "allowedHosts": ["openrouter.ai", "storage.googleapis.com", "lh3.googleusercontent.com"]
        },
        "action": {
          "pattern": "^[a-zA-Z0-9_]+$"
        }
      }
    },
    "limits": {
      "messageMaxLength": 32000,
      "conversationTitleMaxLength": 200,
      "fileMaxSizeBytes": 10485760,
      "supportedFileTypes": ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "text/markdown"],
      "paginationDefaultLimit": 20,
      "paginationMaxLimit": 50,
      "searchMaxResults": 10,
      "uploadUrlExpiryMs": 900000,
      "rateLimit": {
        "chatPerMinute": 20,
        "uploadPerMinute": 30,
        "windowMs": 60000
      }
    },
    "ai": {
      "routerMaxTokens": 512,
      "titleMaxTokens": 50,
      "chatMaxTokens": 4096,
      "routerTemperature": 0,
      "titleTemperature": 0.3
    },
    "search": {
      "defaultDepth": "basic",
      "includeImagesByDefault": true,
      "toolName": "web_search"
    },
    "ux": {
      "autoScrollThreshold": 100,
      "thinkingCollapseDefault": true,
      "copyFeedbackDurationMs": 2000
    },
    "features": {
      "searchEnabled": true,
      "a2uiEnabled": true
    }
  }
  $$::jsonb,
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM runtime_configs
  WHERE scope = 'system'
);
--> statement-breakpoint
UPDATE runtime_configs
SET payload = jsonb_set(payload, '{models,routerModel}', '"google/gemini-3-flash-preview"', true),
    updated_at = NOW()
WHERE scope = 'system';
