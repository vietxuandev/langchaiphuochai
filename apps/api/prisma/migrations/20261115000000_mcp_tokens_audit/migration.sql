-- Token cho AI agent (MCP) + nhật ký gọi tool + chống tạo trùng.

CREATE TABLE IF NOT EXISTS "api_tokens" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "prefix"     TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "agentName"  TEXT,
  "expiresAt"  TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "api_tokens_userId_idx" ON "api_tokens"("userId");

DO $$
BEGIN
  ALTER TABLE "api_tokens"
    ADD CONSTRAINT "api_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "mcp_audit_logs" (
  "id"         TEXT NOT NULL,
  "tokenId"    TEXT,
  "userId"     TEXT,
  "tool"       TEXT NOT NULL,
  "status"     TEXT NOT NULL,
  "errorCode"  TEXT,
  "postId"     TEXT,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "args"       JSONB,
  "ipHash"     TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mcp_audit_logs_createdAt_idx" ON "mcp_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "mcp_audit_logs_tokenId_createdAt_idx" ON "mcp_audit_logs"("tokenId", "createdAt");

CREATE TABLE IF NOT EXISTS "mcp_idempotency" (
  "id"        TEXT NOT NULL,
  "tokenId"   TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "postId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mcp_idempotency_tokenId_key_key" ON "mcp_idempotency"("tokenId", "key");
CREATE INDEX IF NOT EXISTS "mcp_idempotency_createdAt_idx" ON "mcp_idempotency"("createdAt");
