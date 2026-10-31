import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAdmin, getSession } from '@/lib/auth';
import { getEventContext, ACTIVE_EVENT_COOKIE } from '@/lib/event-context';
import { cookies } from 'next/headers';

const EventCreateSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  subtitle: z.string().optional(),
  organizerName: z.string().optional(),
  venue: z.string().min(2),
  city: z.string().optional(),
  state: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().or(z.string().min(10)),
  endDate: z.string().datetime().or(z.string().min(10)),
  ticketPrefix: z.string().min(2).max(10).optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  logoUrl: z.string().optional(),
  organizerLogoUrl: z.string().optional(),
  categories: z.array(z.string()).optional(),
  stations: z.array(z.any()).optional(),
  whatsappTemplate: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If Operator or Vendor, ONLY return their assigned event!
    if (session.role !== 'ADMIN') {
      const eventCtx = await getEventContext();
      if (!eventCtx) {
        return NextResponse.json({ events: [] });
      }
      return NextResponse.json({
        events: [
          {
            ...eventCtx.event,
            registrationsCount: 0,
            isCurrentActive: true,
          },
        ],
      });
    }

    // Super Admin: List all events with counts and indicate currently active one
    const cookieStore = await cookies();
    const activeEventId = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;

    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            registrations: true,
            users: true,
          },
        },
      },
    });

    const enriched = events.map((ev, index) => {
      const isCurrentActive = activeEventId
        ? ev.id === activeEventId
        : index === 0; // default to first event if no cookie

      return {
        ...ev,
        registrationsCount: ev._count.registrations,
        staffCount: ev._count.users,
        isCurrentActive,
      };
    });

    return NextResponse.json({ events: enriched });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to retrieve events';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = EventCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const defaultStations = [
      { code: 'MEAL_D1_LUNCH', label: 'Day 1: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
      { code: 'MEAL_D1_DINNER', label: 'Day 1: Gala Dinner (19:30 - 22:00)', category: 'MEAL', icon: '🍷' },
      { code: 'KIT_DISTRIBUTION', label: 'Delegate Conference Kit Distribution', category: 'KIT', icon: '🎒' },
    ];

    const defaultCategories = ['DELEGATE', 'PG STUDENT', 'FACULTY'];

    let finalPrefix = (parsed.data.ticketPrefix || 'CONF-2026').trim().toUpperCase();
    const existingWithSamePrefix = await prisma.event.findFirst({
      where: { ticketPrefix: finalPrefix },
    });
    if (existingWithSamePrefix) {
      const randSuffix = Math.floor(10 + Math.random() * 90);
      finalPrefix = `${finalPrefix}-${randSuffix}`;
    }

    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
        subtitle: parsed.data.subtitle || 'Annual Conference',
        organizerName: parsed.data.organizerName || 'Organizing Committee',
        venue: parsed.data.venue,
        city: parsed.data.city || parsed.data.venue.split(',')[0]?.trim() || '',
        state: parsed.data.state || parsed.data.venue.split(',')[1]?.trim() || '',
        description: parsed.data.description,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        ticketPrefix: finalPrefix,
        primaryColor: parsed.data.primaryColor || '#0d625e',
        accentColor: parsed.data.accentColor || '#10b981',
        logoUrl: parsed.data.logoUrl || null,
        organizerLogoUrl: parsed.data.organizerLogoUrl || null,
        categories: parsed.data.categories || defaultCategories,
        stations: parsed.data.stations || defaultStations,
        whatsappTemplate: parsed.data.whatsappTemplate || null,
        isActive: true,
      },
    });

    // Auto-switch Super Admin to this newly created event!
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_EVENT_COOKIE, event.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return NextResponse.json({ event, autoSelected: true }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'An event with this code/slug already exists.' }, { status: 409 });
    }
    const errorMsg = error instanceof Error ? error.message : 'Failed to create event';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
