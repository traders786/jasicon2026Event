import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug')?.toLowerCase().trim();
    const eventId = searchParams.get('id');

    let event = null;

    if (slug) {
      event = await prisma.event.findUnique({
        where: { slug },
      });
    } else if (eventId) {
      event = await prisma.event.findUnique({
        where: { id: eventId },
      });
    }

    // Fallback: get the most recent active event
    if (!event) {
      event = await prisma.event.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!event) {
      return NextResponse.json({ error: 'No active event found' }, { status: 404 });
    }

    // Only return safe public branding metadata (no attendee details or confidential credentials)
    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        subtitle: event.subtitle || 'Annual Conference',
        organizerName: event.organizerName || 'Organizing Committee',
        venue: event.venue,
        city: event.city || '',
        state: event.state || '',
        startDate: event.startDate,
        endDate: event.endDate,
        logoUrl: event.logoUrl || null,
        organizerLogoUrl: event.organizerLogoUrl || null,
        primaryColor: event.primaryColor || '#0d625e',
        accentColor: event.accentColor || '#10b981',
        ticketPrefix: event.ticketPrefix || 'EC-2026',
        stations: (event.stations as any[]) || [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve event public branding';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
