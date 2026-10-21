-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntitlementCategory" AS ENUM ('MEAL', 'SESSION');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RedemptionResult" AS ENUM ('SUCCESS', 'ALREADY_REDEEMED', 'INVALID_QR', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "qrTokenHash" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "category" "EntitlementCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'AVAILABLE',
    "redeemedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemption_logs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "entitlementId" TEXT,
    "operatorId" TEXT,
    "result" "RedemptionResult" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "notes" TEXT,

    CONSTRAINT "redemption_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "people_email_key" ON "people"("email");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_ticketCode_key" ON "event_registrations"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_qrTokenHash_key" ON "event_registrations"("qrTokenHash");

-- CreateIndex
CREATE INDEX "event_registrations_eventId_status_idx" ON "event_registrations"("eventId", "status");

-- CreateIndex
CREATE INDEX "entitlements_registrationId_category_idx" ON "entitlements"("registrationId", "category");

-- CreateIndex
CREATE INDEX "entitlements_code_status_idx" ON "entitlements"("code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_registrationId_code_key" ON "entitlements"("registrationId", "code");

-- CreateIndex
CREATE INDEX "redemption_logs_registrationId_scannedAt_idx" ON "redemption_logs"("registrationId", "scannedAt");

-- CreateIndex
CREATE INDEX "redemption_logs_entitlementId_idx" ON "redemption_logs"("entitlementId");

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_logs" ADD CONSTRAINT "redemption_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_logs" ADD CONSTRAINT "redemption_logs_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_logs" ADD CONSTRAINT "redemption_logs_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
