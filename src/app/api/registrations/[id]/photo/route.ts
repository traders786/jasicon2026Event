import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { id },
      include: { person: true },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Participant registration not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let photoUrl = '';

    // A. Form Data File Upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('photo') as File | null;

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      // Check max file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size must be under 5MB' }, { status: 400 });
      }

      // Determine extension
      const fileType = file.type || '';
      let ext = '.jpg';
      if (fileType.includes('png')) ext = '.png';
      else if (fileType.includes('webp')) ext = '.webp';
      else if (fileType.includes('gif')) ext = '.gif';

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save to public/uploads/avatars
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
      await fs.mkdir(uploadsDir, { recursive: true });

      const safeFilename = `avatar_${registration.person.id}_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, safeFilename);
      await fs.writeFile(filePath, buffer);

      photoUrl = `/uploads/avatars/${safeFilename}`;
    }
    // B. Base64 JSON Payload (e.g. from camera capture or data URL)
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const base64Data = body.photoData || body.photoUrl;

      if (!base64Data || typeof base64Data !== 'string') {
        return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
      }

      // Extract raw base64 if it's a data URL
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const rawBase64 = matches[2];
        let ext = '.jpg';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';

        const buffer = Buffer.from(rawBase64, 'base64');
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
        await fs.mkdir(uploadsDir, { recursive: true });

        const safeFilename = `avatar_${registration.person.id}_${Date.now()}${ext}`;
        const filePath = path.join(uploadsDir, safeFilename);
        await fs.writeFile(filePath, buffer);

        photoUrl = `/uploads/avatars/${safeFilename}`;
      } else if (base64Data.startsWith('http://') || base64Data.startsWith('https://') || base64Data.startsWith('/')) {
        photoUrl = base64Data;
      } else {
        return NextResponse.json({ error: 'Invalid photo data format' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }

    // Update person in database
    await prisma.person.update({
      where: { id: registration.person.id },
      data: { photoUrl },
    });

    return NextResponse.json({
      success: true,
      photoUrl,
      message: 'Profile photo updated successfully',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to upload photo';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
