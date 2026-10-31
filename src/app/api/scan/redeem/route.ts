import { NextResponse } from 'next/server';
import { redeemEntitlement } from '@/lib/redemption';
import { getSession } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';
import { z } from 'zod';

const RedeemSchema = z.object({
  qrToken: z.string().min(1),
  entitlementCode: z.string().min(1),
  deviceInfo: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RedeemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid redemption request payload' }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const eventCtx = await getEventContext();
    if (!eventCtx) {
      return NextResponse.json({ error: 'No active or assigned event context found.' }, { status: 403 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const response = await redeemEntitlement({
      qrToken: parsed.data.qrToken,
      entitlementCode: parsed.data.entitlementCode,
      operatorId: session.userId,
      deviceInfo: parsed.data.deviceInfo || 'EventCheck Web Scanner',
      ipAddress,
      expectedEventId: eventCtx.eventId,
      allowedStationCode: eventCtx.assignedStationCode || undefined,
    });

    const statusCode = response.success ? 200 : response.result === 'ALREADY_REDEEMED' ? 409 : 400;

    return NextResponse.json(response, { status: statusCode });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Redemption processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
