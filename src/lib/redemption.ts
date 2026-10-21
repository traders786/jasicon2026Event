import { prisma } from './prisma';
import { hashQrToken } from './qr';
import { Prisma, RedemptionResult, EntitlementStatus } from '@prisma/client';

export interface RedemptionRequest {
  qrToken: string;
  entitlementCode: string;
  operatorId?: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface RedemptionResponse {
  success: boolean;
  result: RedemptionResult;
  message: string;
  participant?: {
    name: string;
    email: string;
    company: string | null;
    ticketCode: string;
    checkedIn: boolean;
  };
  entitlement?: {
    code: string;
    title: string;
    category: string;
    status: EntitlementStatus;
    redeemedAt: Date | null;
  };
}

/**
 * Resolves a registration from ANY valid scanner input:
 * 1. Bearer token (e.g. ec_tok_...) -> hashed via SHA-256 and matched against qrTokenHash
 * 2. Human-readable ticket code (e.g. EC-2026-0008, EC-TEST-...) -> matched case-insensitively against ticketCode
 * 3. Formatted badge payload (e.g. EC_TICKET:EC-2026-0008:uuid) -> parsed and matched against ticketCode or id
 * 4. Scanned URL containing token or ticket parameter -> parsed and matched
 * 5. Scanned JSON payload containing token or ticket -> parsed and matched
 */
export async function resolveRegistration(rawInput: string) {
  if (!rawInput || typeof rawInput !== 'string') return null;

  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const orClauses: Prisma.EventRegistrationWhereInput[] = [];

  // A. Check for EC_TICKET:code:id format
  if (trimmed.startsWith('EC_TICKET:')) {
    const parts = trimmed.split(':');
    const ticketCode = parts[1]?.trim();
    const id = parts[2]?.trim();
    if (ticketCode) {
      orClauses.push({ ticketCode: { equals: ticketCode, mode: 'insensitive' } });
    }
    if (id && /^[0-9a-fA-F-]{36}$/.test(id)) {
      orClauses.push({ id });
    }
  }
  // B. Check for URL format
  else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const urlToken = url.searchParams.get('token') || url.searchParams.get('qrToken');
      const urlTicket = url.searchParams.get('ticket') || url.searchParams.get('ticketCode');
      if (urlToken) {
        orClauses.push({ qrTokenHash: hashQrToken(urlToken) });
      }
      if (urlTicket) {
        orClauses.push({ ticketCode: { equals: urlTicket, mode: 'insensitive' } });
      }
      const lastSeg = url.pathname.split('/').filter(Boolean).pop();
      if (lastSeg && /^EC-[A-Za-z0-9_-]+$/i.test(lastSeg)) {
        orClauses.push({ ticketCode: { equals: lastSeg, mode: 'insensitive' } });
      }
    } catch {
      // Continue to raw parsing
    }
  }
  // C. Check for JSON format
  else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.token || parsed.qrToken) {
        orClauses.push({ qrTokenHash: hashQrToken(String(parsed.token || parsed.qrToken)) });
      }
      if (parsed.ticketCode || parsed.ticket) {
        orClauses.push({ ticketCode: { equals: String(parsed.ticketCode || parsed.ticket), mode: 'insensitive' } });
      }
      if (parsed.id) {
        orClauses.push({ id: String(parsed.id) });
      }
    } catch {
      // Continue to raw parsing
    }
  }

  // D. Direct bearer token check (starts with ec_tok_)
  if (trimmed.startsWith('ec_tok_')) {
    orClauses.push({ qrTokenHash: hashQrToken(trimmed) });
  }

  // E. Ticket code check (e.g. EC-2026-0008 or EC-...)
  if (/^EC-[A-Za-z0-9_-]+$/i.test(trimmed)) {
    orClauses.push({ ticketCode: { equals: trimmed, mode: 'insensitive' } });
  }

  // F. Fallback: Always check raw hash and raw ticketCode to handle unexpected formats
  const rawHash = hashQrToken(trimmed);
  orClauses.push({ qrTokenHash: rawHash });
  orClauses.push({ ticketCode: { equals: trimmed, mode: 'insensitive' } });

  return prisma.eventRegistration.findFirst({
    where: {
      OR: orClauses,
    },
    include: {
      person: true,
      event: true,
      entitlements: {
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      },
    },
  });
}

/**
 * Look up registration and all 19 entitlements from a scanned QR token or ticket code.
 */
export async function lookupByQrToken(qrToken: string) {
  const registration = await resolveRegistration(qrToken);

  if (!registration) {
    return null;
  }

  const meals = registration.entitlements.filter((e) => e.category === 'MEAL');
  const sessions = registration.entitlements.filter((e) => e.category === 'SESSION');

  const mealsRedeemedCount = meals.filter((m) => m.status === 'REDEEMED').length;
  const sessionsRedeemedCount = sessions.filter((s) => s.status === 'REDEEMED').length;

  return {
    registration,
    person: registration.person,
    event: registration.event,
    entitlements: registration.entitlements,
    meals,
    sessions,
    stats: {
      mealsTotal: meals.length,
      mealsRedeemed: mealsRedeemedCount,
      sessionsTotal: sessions.length,
      sessionsRedeemed: sessionsRedeemedCount,
      checkedIn: registration.status === 'CHECKED_IN',
    },
  };
}

/**
 * Atomically redeems an entitlement with optimistic concurrency control.
 * Prevents double-redemption race conditions across concurrent scanners.
 * Seamlessly resolves either bearer tokens or ticket codes.
 */
export async function redeemEntitlement(
  req: RedemptionRequest
): Promise<RedemptionResponse> {
  // 1. Resolve registration consistently
  const registration = await resolveRegistration(req.qrToken);

  if (!registration) {
    return {
      success: false,
      result: RedemptionResult.INVALID_QR,
      message: 'Invalid QR code or ticket. No active registration matches this token.',
    };
  }

  const entitlement = registration.entitlements.find((e) => e.code === req.entitlementCode);
  if (!entitlement) {
    return {
      success: false,
      result: RedemptionResult.ERROR,
      message: `Entitlement with code "${req.entitlementCode}" is not attached to this registration.`,
    };
  }

  const participantInfo = {
    name: `${registration.person.firstName} ${registration.person.lastName}`,
    email: registration.person.email,
    company: registration.person.company,
    ticketCode: registration.ticketCode,
    checkedIn: registration.status === 'CHECKED_IN',
  };

  // 2. Check current status before transaction
  if (entitlement.status === EntitlementStatus.REDEEMED) {
    // Record duplicate attempt audit log
    await prisma.redemptionLog.create({
      data: {
        registrationId: registration.id,
        entitlementId: entitlement.id,
        operatorId: req.operatorId,
        result: RedemptionResult.ALREADY_REDEEMED,
        deviceInfo: req.deviceInfo,
        ipAddress: req.ipAddress,
        notes: `Duplicate redemption attempt for ${entitlement.title}. Originally redeemed at ${entitlement.redeemedAt?.toISOString()}`,
      },
    });

    return {
      success: false,
      result: RedemptionResult.ALREADY_REDEEMED,
      message: `ALREADY REDEEMED: ${entitlement.title} was already redeemed at ${entitlement.redeemedAt?.toLocaleTimeString()}`,
      participant: participantInfo,
      entitlement: {
        code: entitlement.code,
        title: entitlement.title,
        category: entitlement.category,
        status: entitlement.status,
        redeemedAt: entitlement.redeemedAt,
      },
    };
  }

  if (entitlement.status === EntitlementStatus.REVOKED || entitlement.status === EntitlementStatus.EXPIRED) {
    await prisma.redemptionLog.create({
      data: {
        registrationId: registration.id,
        entitlementId: entitlement.id,
        operatorId: req.operatorId,
        result: RedemptionResult.REVOKED,
        deviceInfo: req.deviceInfo,
        ipAddress: req.ipAddress,
        notes: `Attempted redemption on invalid state: ${entitlement.status}`,
      },
    });

    return {
      success: false,
      result: RedemptionResult.REVOKED,
      message: `Cannot redeem: entitlement is ${entitlement.status}.`,
      participant: participantInfo,
    };
  }

  // 3. Atomic optimistic concurrency transaction
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional atomic update with version checking
      const updateResult = await tx.entitlement.updateMany({
        where: {
          id: entitlement.id,
          version: entitlement.version, // Optimistic lock
          status: EntitlementStatus.AVAILABLE,
        },
        data: {
          status: EntitlementStatus.REDEEMED,
          redeemedAt: now,
          version: { increment: 1 },
        },
      });

      // If zero rows updated, another concurrent worker redeemed it first!
      if (updateResult.count === 0) {
        throw new Error('CONCURRENCY_CONFLICT');
      }

      // Automatically update check-in status if this is their first check-in
      if (registration.status !== 'CHECKED_IN') {
        await tx.eventRegistration.update({
          where: { id: registration.id },
          data: {
            status: 'CHECKED_IN',
            checkedInAt: now,
          },
        });
      }

      // Record successful audit log
      const auditLog = await tx.redemptionLog.create({
        data: {
          registrationId: registration.id,
          entitlementId: entitlement.id,
          operatorId: req.operatorId,
          result: RedemptionResult.SUCCESS,
          deviceInfo: req.deviceInfo,
          ipAddress: req.ipAddress,
          notes: `Successfully redeemed ${entitlement.title}`,
        },
      });

      return { auditLog };
    });

    return {
      success: true,
      result: RedemptionResult.SUCCESS,
      message: `SUCCESS: ${entitlement.title} successfully redeemed for ${participantInfo.name}!`,
      participant: {
        ...participantInfo,
        checkedIn: true,
      },
      entitlement: {
        code: entitlement.code,
        title: entitlement.title,
        category: entitlement.category,
        status: EntitlementStatus.REDEEMED,
        redeemedAt: now,
      },
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    if (errorMsg === 'CONCURRENCY_CONFLICT') {
      try {
        await prisma.redemptionLog.create({
          data: {
            registrationId: registration.id,
            entitlementId: entitlement.id,
            operatorId: req.operatorId,
            result: RedemptionResult.ALREADY_REDEEMED,
            deviceInfo: req.deviceInfo,
            ipAddress: req.ipAddress,
            notes: `Concurrency collision: simultaneous claim blocked for ${entitlement.title}`,
          },
        });
      } catch {
        // Audit log fallback should not mask the collision response
      }

      return {
        success: false,
        result: RedemptionResult.ALREADY_REDEEMED,
        message: 'COLLISION DETECTED: Another scanner just redeemed this entitlement milliseconds ago.',
        participant: participantInfo,
      };
    }

    return {
      success: false,
      result: RedemptionResult.ERROR,
      message: `Redemption transaction failed: ${errorMsg}`,
      participant: participantInfo,
    };
  }
}
