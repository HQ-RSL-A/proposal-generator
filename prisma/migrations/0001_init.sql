-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "proposals";

-- CreateEnum
CREATE TYPE "proposals"."ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "proposals"."PaymentStatus" AS ENUM ('NOT_REQUIRED', 'AWAITING', 'PROCESSING', 'PAID', 'FAILED', 'SESSION_EXPIRED');

-- CreateEnum
CREATE TYPE "proposals"."PartyRole" AS ENUM ('ADMIN_SIGNER', 'CLIENT_SIGNER');

-- CreateEnum
CREATE TYPE "proposals"."SignatureType" AS ENUM ('DRAWN', 'TYPED', 'PRE_APPLIED');

-- CreateEnum
CREATE TYPE "proposals"."AuditEventType" AS ENUM ('PROPOSAL_CREATED', 'PROPOSAL_SENT', 'PROPOSAL_REVISED', 'EMAIL_SENT', 'EMAIL_DELIVERED', 'EMAIL_OPENED', 'EMAIL_BOUNCED', 'PAGE_VIEWED', 'TIER_SELECTED', 'ESIGN_CONSENTED', 'PARTY_SIGNED', 'ALL_SIGNED', 'PARTY_DECLINED', 'PROPOSAL_VOIDED', 'PROPOSAL_EXPIRED', 'CHECKOUT_CREATED', 'PAYMENT_PAID', 'PAYMENT_PROCESSING', 'PAYMENT_FAILED', 'CHECKOUT_EXPIRED', 'PDF_GENERATED', 'NOTION_SYNCED', 'STRIPE_METADATA_ATTACHED', 'REMINDER_SENT');

-- CreateEnum
CREATE TYPE "proposals"."EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "proposals"."JobType" AS ENUM ('SEND_EMAIL', 'NOTION_SYNC', 'STRIPE_METADATA', 'GENERATE_PDF');

-- CreateEnum
CREATE TYPE "proposals"."JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'DEAD');

-- CreateTable
CREATE TABLE "proposals"."MsaVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MsaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."Proposal" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "status" "proposals"."ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "proposals"."PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "tokens" JSONB NOT NULL,
    "paymentConfig" JSONB NOT NULL,
    "msaVersionId" TEXT NOT NULL,
    "frozenContent" JSONB,
    "contentHash" TEXT,
    "frozenAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "selectedTierId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripeCustomerId" TEXT,
    "notionPageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."Party" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "role" "proposals"."PartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "payer" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "signingTokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declinedReason" TEXT,
    "emailBounced" BOOLEAN NOT NULL DEFAULT false,
    "emailComplained" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."Signature" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "type" "proposals"."SignatureType" NOT NULL,
    "imageBlobUrl" TEXT NOT NULL,
    "adoptedName" TEXT NOT NULL,
    "fontFamily" TEXT,
    "esignConsented" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."AuditEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "partyId" TEXT,
    "eventType" "proposals"."AuditEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."EmailLog" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "partyId" TEXT,
    "templateId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "resendMessageId" TEXT,
    "status" "proposals"."EmailStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."Payment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "amountTotalCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."GeneratedDocument" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."PendingJob" (
    "id" TEXT NOT NULL,
    "jobType" "proposals"."JobType" NOT NULL,
    "status" "proposals"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "proposalId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "proposalId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."AdminSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "signatureBlobUrl" TEXT,
    "signatureAdoptedName" TEXT,
    "signatureType" "proposals"."SignatureType" NOT NULL DEFAULT 'DRAWN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals"."CronLog" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "CronLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MsaVersion_version_key" ON "proposals"."MsaVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_stripeCheckoutSessionId_key" ON "proposals"."Proposal"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "proposals"."Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_validUntil_idx" ON "proposals"."Proposal"("validUntil");

-- CreateIndex
CREATE INDEX "Proposal_parentId_idx" ON "proposals"."Proposal"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_signingTokenHash_key" ON "proposals"."Party"("signingTokenHash");

-- CreateIndex
CREATE INDEX "Party_proposalId_idx" ON "proposals"."Party"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_proposalId_email_key" ON "proposals"."Party"("proposalId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_partyId_key" ON "proposals"."Signature"("partyId");

-- CreateIndex
CREATE INDEX "Signature_proposalId_idx" ON "proposals"."Signature"("proposalId");

-- CreateIndex
CREATE INDEX "AuditEvent_proposalId_occurredAt_idx" ON "proposals"."AuditEvent"("proposalId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_resendMessageId_key" ON "proposals"."EmailLog"("resendMessageId");

-- CreateIndex
CREATE INDEX "EmailLog_proposalId_idx" ON "proposals"."EmailLog"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_proposalId_key" ON "proposals"."Payment"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "proposals"."Payment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_proposalId_idx" ON "proposals"."GeneratedDocument"("proposalId");

-- CreateIndex
CREATE INDEX "PendingJob_status_scheduledAt_idx" ON "proposals"."PendingJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PendingJob_proposalId_idx" ON "proposals"."PendingJob"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalId_key" ON "proposals"."WebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "CronLog_path_ranAt_idx" ON "proposals"."CronLog"("path", "ranAt");

-- AddForeignKey
ALTER TABLE "proposals"."Proposal" ADD CONSTRAINT "Proposal_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "proposals"."Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."Proposal" ADD CONSTRAINT "Proposal_msaVersionId_fkey" FOREIGN KEY ("msaVersionId") REFERENCES "proposals"."MsaVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."Party" ADD CONSTRAINT "Party_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."Signature" ADD CONSTRAINT "Signature_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."Signature" ADD CONSTRAINT "Signature_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "proposals"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."AuditEvent" ADD CONSTRAINT "AuditEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."AuditEvent" ADD CONSTRAINT "AuditEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "proposals"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."EmailLog" ADD CONSTRAINT "EmailLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."EmailLog" ADD CONSTRAINT "EmailLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "proposals"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."Payment" ADD CONSTRAINT "Payment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals"."PendingJob" ADD CONSTRAINT "PendingJob_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"."Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
