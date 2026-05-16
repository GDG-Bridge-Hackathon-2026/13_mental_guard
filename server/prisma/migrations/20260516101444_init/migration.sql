-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('AGENT', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('VOICE', 'TEXT', 'MIXED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('KO', 'JA', 'AUTO');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('CAPTION_RELAY', 'TEXT_ONLY', 'DEMO');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'WAITING', 'ACTIVE', 'PAUSED', 'ENDING', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('CALLER', 'AGENT');

-- CreateEnum
CREATE TYPE "TurnSource" AS ENUM ('VOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('CAPTION', 'AUDIO', 'TEXT');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "Emotion" AS ENUM ('ANGER', 'FRUSTRATION', 'CYNICISM', 'CONFUSION', 'CALM');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('LEGITIMATE_COMPLAINT', 'VENT', 'THREAT', 'INSULT', 'INQUIRY');

-- CreateEnum
CREATE TYPE "Trend" AS ENUM ('UP', 'DOWN', 'STABLE');

-- CreateEnum
CREATE TYPE "ActionLevel" AS ENUM ('NORMAL', 'CAUTION', 'ESCALATE', 'TERMINATE_ALLOWED', 'LEGAL_ACTION');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CAPTION_PARTIAL', 'CAPTION_FINAL', 'RISK_UPDATE', 'SUMMARY_UPDATE', 'THRESHOLD_WARNING', 'THRESHOLD_TERMINATE_ALLOWED', 'AGENT_AUDIO_READY', 'SESSION_STATUS', 'SESSION_PAUSED', 'SESSION_ENDED', 'ERROR');

-- CreateEnum
CREATE TYPE "EscalationType" AS ENUM ('SUPERVISOR_CALL', 'TERMINATE', 'LEGAL_REPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "photo_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "caller_id" TEXT,
    "channel" "Channel" NOT NULL,
    "language" "Language" NOT NULL,
    "mode" "SessionMode" NOT NULL DEFAULT 'CAPTION_RELAY',
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "total_turns" INTEGER NOT NULL DEFAULT 0,
    "cumulative_threat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factual_ratio_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repetition_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classification_distribution" JSONB NOT NULL,
    "final_classification" "Classification",
    "final_action" "ActionLevel",
    "legal_basis" JSONB,
    "core_demands" JSONB,
    "summary" JSONB,
    "metadata" JSONB,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "source" "TurnSource" NOT NULL,
    "delivery_method" "DeliveryMethod" NOT NULL,
    "raw_text" TEXT NOT NULL,
    "raw_audio_url" TEXT,
    "stt_url" TEXT,
    "displayed_text" TEXT,
    "is_filtered" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,
    "stt_confidence" DOUBLE PRECISION,
    "latency_ms" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "turn_id" TEXT NOT NULL,
    "refined" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "classification" "Classification" NOT NULL,
    "preserved_facts" JSONB NOT NULL DEFAULT '[]',
    "removed_expressions" JSONB NOT NULL DEFAULT '[]',
    "abuse_types" JSONB NOT NULL DEFAULT '[]',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommended_action" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "EscalationType" NOT NULL,
    "reason" TEXT,
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "turn_id" TEXT,
    "field" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "actual" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_agent_id_started_at_idx" ON "sessions"("agent_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_ended_at_idx" ON "sessions"("ended_at");

-- CreateIndex
CREATE INDEX "turns_session_id_seq_idx" ON "turns"("session_id", "seq");

-- CreateIndex
CREATE INDEX "turns_speaker_idx" ON "turns"("speaker");

-- CreateIndex
CREATE UNIQUE INDEX "turns_session_id_seq_key" ON "turns"("session_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_turn_id_key" ON "analyses"("turn_id");

-- CreateIndex
CREATE INDEX "analyses_classification_idx" ON "analyses"("classification");

-- CreateIndex
CREATE INDEX "session_events_session_id_timestamp_idx" ON "session_events"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "notes_session_id_idx" ON "notes"("session_id");

-- CreateIndex
CREATE INDEX "escalations_session_id_idx" ON "escalations"("session_id");

-- CreateIndex
CREATE INDEX "feedbacks_session_id_idx" ON "feedbacks"("session_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
