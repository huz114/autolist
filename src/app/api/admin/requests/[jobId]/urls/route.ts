import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/requests/[jobId]/urls
 * 特定ジョブのCollectedUrl一覧を返す
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  try {
    const { jobId } = params;

    const urls = await prisma.collectedUrl.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        companyName: true,
        url: true,
        phoneNumber: true,
        formUrl: true,
        hasForm: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('GET /api/admin/requests/[jobId]/urls error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
