import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';

const EventCreateSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  venue: z.string().min(2),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'asc' },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    return NextResponse.json({ events });
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

    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug.toLowerCase().trim(),
        venue: parsed.data.venue,
        description: parsed.data.description,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'An event with this slug already exists.' }, { status: 409 });
    }
    const errorMsg = error instanceof Error ? error.message : 'Failed to create event';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
