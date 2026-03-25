import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * GET /api/admin/requests/[jobId]/urls
 * 特定ジョブのCollectedUrl一覧を返す
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 });
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email ?? '')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

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
