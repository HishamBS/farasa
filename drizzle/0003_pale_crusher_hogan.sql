ALTER TABLE "conversations" ADD COLUMN "web_search_enabled" boolean DEFAULT false NOT NULL;
UPDATE "conversations"
SET "search_mode" = 'chat'
WHERE "search_mode" = 'search' OR "search_mode" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_search_mode_check'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_search_mode_check"
      CHECK ("search_mode" IN ('chat', 'group'));
  END IF;
END
$$;
