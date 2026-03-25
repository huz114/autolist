import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * GET /api/admin/search-logs?page=1&limit=20
 * searchQueriesが保存されているListJobの一覧を返す
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 });
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email ?? '')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.listJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          keyword: true,
          industry: true,
          location: true,
          targetCount: true,
          status: true,
          totalFound: true,
          searchQueries: true,
          createdAt: true,
          userId: true,
        },
      }),
      prisma.listJob.count(),
    ]);

    // userId から LineUser 情報を取得
    const userIds = Array.from(new Set(jobs.map((j) => j.userId)));
    const lineUsers = await prisma.lineUser.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, displayName: true, lineUserId: true },
    });
    const lineUserMap = new Map(lineUsers.map((lu) => [lu.userId, lu]));

    const jobsWithUser = jobs.map((job) => {
      const lu = lineUserMap.get(job.userId);
      return {
        ...job,
        user: {
          displayName: lu?.displayName ?? null,
          lineUserId: lu?.lineUserId ?? null,
        },
      };
    });

    return NextResponse.json({ jobs: jobsWithUser, total, page });
  } catch (error) {
    console.error('GET /api/admin/search-logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
