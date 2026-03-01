ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "client_request_id" text;

ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "stream_sequence_max" integer;

DROP INDEX IF EXISTS "msg_conv_request_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "msg_conv_request_unique"
ON "messages" ("conversation_id", "role", "client_request_id")
WHERE "client_request_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "runtime_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "scope_key" text,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "runtime_scope_check"
    CHECK (
      (scope = 'system' AND scope_key IS NULL)
      OR (scope IN ('tenant', 'user') AND scope_key IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "runtime_scope_unique"
ON "runtime_configs" ("scope", "scope_key");

CREATE INDEX IF NOT EXISTS "runtime_scope_idx"
ON "runtime_configs" ("scope", "scope_key");
