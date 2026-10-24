import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { getSession, SessionPayload } from './auth';

export const ACTIVE_EVENT_COOKIE = 'evently_active_event_id';

export interface EventBranding {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  organizerName: string | null;
  venue: string;
  city: string | null;
  state: string | null;
  startDate: Date;
  endDate: Date;
  ticketPrefix: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  organizerLogoUrl: string | null;
  categories: string[];
  stations: Array<{ code: string; label: string; category: string; icon: string }>;
  whatsappTemplate: string | null;
  isActive: boolean;
}

export interface EventContextResult {
  event: EventBranding;
  eventId: string;
  session: SessionPayload;
  isSuperAdmin: boolean;
  assignedStationCode: string | null;
}

const DEFAULT_STATIONS = [
  { code: 'MEAL_D1_BREAKFAST', label: 'Day 1: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D1_LUNCH', label: 'Day 1: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D1_DINNER', label: 'Day 1: Welcome Gala Dinner (19:00 - 21:30)', category: 'MEAL', icon: '🍷' },
  { code: 'MEAL_D2_BREAKFAST', label: 'Day 2: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D2_LUNCH', label: 'Day 2: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D2_DINNER', label: 'Day 2: Networking Banquet (19:00 - 21:30)', category: 'MEAL', icon: '🥂' },
  { code: 'MEAL_D3_BREAKFAST', label: 'Day 3: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D3_LUNCH', label: 'Day 3: Farewell Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D3_DINNER', label: 'Day 3: Closing Dinner (19:00 - 21:00)', category: 'MEAL', icon: '🍲' },
  { code: 'SES_01_KEYNOTE', label: 'Session 01: Keynote & Opening Ceremony', category: 'SESSION', icon: '🎙️' },
  { code: 'SES_07_WORKSHOP_A', label: 'Session 07: Hands-On Microservices Lab', category: 'SESSION', icon: '💻' },
  { code: 'SES_08_WORKSHOP_B', label: 'Session 08: Distributed Consensus Workshop', category: 'SESSION', icon: '🔬' },
];

const DEFAULT_CATEGORIES = ['DELEGATE', 'PG STUDENT', 'FACULTY'];

function mapEventToBranding(raw: any): EventBranding {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    subtitle: raw.subtitle || 'Annual Conference',
    organizerName: raw.organizerName || 'Organizing Committee',
    venue: raw.venue,
    city: raw.city || raw.venue.split(',')[0]?.trim() || '',
    state: raw.state || raw.venue.split(',')[1]?.trim() || '',
    startDate: raw.startDate,
    endDate: raw.endDate,
    ticketPrefix: raw.ticketPrefix || 'JC-2026',
    primaryColor: raw.primaryColor || '#0d625e',
    accentColor: raw.accentColor || '#10b981',
    logoUrl: raw.logoUrl || null,
    organizerLogoUrl: raw.organizerLogoUrl || null,
    categories: Array.isArray(raw.categories) && raw.categories.length > 0 ? raw.categories : DEFAULT_CATEGORIES,
    stations: Array.isArray(raw.stations) && raw.stations.length > 0 ? raw.stations : DEFAULT_STATIONS,
    whatsappTemplate: raw.whatsappTemplate || null,
    isActive: raw.isActive,
  };
}

/**
 * Retrieve the active event context strictly enforcing role isolation.
 * - If Super Admin: Can switch via cookie or query; defaults to active event.
 * - If Staff / Vendor: FORCED to their assignedEventId. Zero cross-event leakage.
 */
export async function getEventContext(): Promise<EventContextResult | null> {
  const session = await getSession();
  if (!session) return null;

  const cookieStore = await cookies();

  // 1. Super Admin: Global scope with switchable active event
  if (session.role === 'ADMIN') {
    const requestedId = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
    let eventRecord = null;

    if (requestedId) {
      eventRecord = await prisma.event.findUnique({
        where: { id: requestedId },
      });
    }

    if (!eventRecord) {
      // Fallback to latest active event
      eventRecord = await prisma.event.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!eventRecord) {
      // Last resort: any event
      eventRecord = await prisma.event.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!eventRecord) return null;

    return {
      event: mapEventToBranding(eventRecord),
      eventId: eventRecord.id,
      session,
      isSuperAdmin: true,
      assignedStationCode: null,
    };
  }

  // 2. Staff / Operator / Vendor: Hard-locked to assignedEventId
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      assignedEventId: true,
      assignedStationCode: true,
      assignedEvent: true,
    },
  });

  if (!dbUser || !dbUser.assignedEventId || !dbUser.assignedEvent) {
    // Staff user has no assigned event or event was deleted
    return null;
  }

  return {
    event: mapEventToBranding(dbUser.assignedEvent),
    eventId: dbUser.assignedEventId,
    session,
    isSuperAdmin: false,
    assignedStationCode: dbUser.assignedStationCode || null,
  };
}

/**
 * Super Admin helper: Fetch all available events with registration counts
 */
export async function getSuperAdminEvents() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return [];

  const rawEvents = await prisma.event.findMany({
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

  return rawEvents.map((e) => ({
    ...mapEventToBranding(e),
    registrationsCount: e._count.registrations,
    staffCount: e._count.users,
  }));
}
