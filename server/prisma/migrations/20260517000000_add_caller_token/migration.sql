-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "caller_token" TEXT,
                       ADD COLUMN "caller_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_caller_token_key" ON "sessions"("caller_token");