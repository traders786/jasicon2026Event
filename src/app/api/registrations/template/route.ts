import { NextResponse } from 'next/server';
import { generateImportTemplate } from '@/lib/spreadsheet';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formatParam = searchParams.get('format')?.toLowerCase();
    const format = formatParam === 'xlsx' ? 'xlsx' : 'csv';

    const { buffer, mimeType, filename } = generateImportTemplate(format);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
