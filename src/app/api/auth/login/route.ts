import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, setSessionCookie } from '@/lib/auth';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password format' }, { status: 400 });
    }

    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    await setSessionCookie(payload);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Authentication error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
