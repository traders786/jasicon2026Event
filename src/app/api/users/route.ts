import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { ACTIVE_EVENT_COOKIE } from '@/lib/event-context';
import { cookies } from 'next/headers';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'OPERATOR', 'VENDOR', 'VOLUNTEER']),
  phone: z.string().optional(),
  assignedEventId: z.string().uuid().optional().nullable(),
  assignedStationCode: z.string().optional().nullable(),
});

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VENDOR', 'VOLUNTEER']).optional(),
  phone: z.string().optional().nullable(),
  assignedEventId: z.string().uuid().optional().nullable(),
  assignedStationCode: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const requestedEventId = searchParams.get('eventId');
    const cookieStore = await cookies();
    const activeEventCookie = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;

    const targetEventId =
      requestedEventId !== null
        ? requestedEventId === 'ALL'
          ? null
          : requestedEventId
        : activeEventCookie;

    const whereClause: any = {};
    if (targetEventId) {
      whereClause.OR = [
        { assignedEventId: targetEventId },
        { role: 'ADMIN' },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        assignedEventId: true,
        assignedStationCode: true,
        assignedEvent: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            redemptions: true,
          },
        },
      },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      assignedEventId: u.assignedEventId,
      assignedStationCode: u.assignedStationCode,
      assignedEvent: u.assignedEvent,
      createdAt: u.createdAt,
      redemptionsCount: u._count.redemptions,
    }));

    return NextResponse.json({ users: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: `User with email "${normalizedEmail}" already exists.` },
        { status: 409 }
      );
    }

    const cookieStore = await cookies();
    const activeEventCookie = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
    const finalEventId = parsed.data.assignedEventId || activeEventCookie || null;

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
        phone: parsed.data.phone || null,
        assignedEventId: finalEventId,
        assignedStationCode: parsed.data.assignedStationCode || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        assignedEventId: true,
        assignedStationCode: true,
        assignedEvent: {
          select: {
            id: true,
            title: true,
          },
        },
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user, message: 'User account created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: {
      isActive?: boolean;
      name?: string;
      role?: 'ADMIN' | 'OPERATOR' | 'VENDOR' | 'VOLUNTEER';
      passwordHash?: string;
      phone?: string | null;
      assignedEventId?: string | null;
      assignedStationCode?: string | null;
    } = {};

    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.name) updateData.name = parsed.data.name.trim();
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.password) updateData.passwordHash = hashPassword(parsed.data.password);
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.assignedEventId !== undefined) updateData.assignedEventId = parsed.data.assignedEventId;
    if (parsed.data.assignedStationCode !== undefined) updateData.assignedStationCode = parsed.data.assignedStationCode;

    const updatedUser = await prisma.user.update({
      where: { id: parsed.data.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        assignedEventId: true,
        assignedStationCode: true,
        assignedEvent: {
          select: {
            id: true,
            title: true,
          },
        },
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (id === auth.session.userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own active administrator account.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Staff account "${targetUser.name}" (${targetUser.email}) deleted successfully.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
