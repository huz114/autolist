import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

type ShiryologUser = {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  phone: string | null;
};

/**
 * GET /api/admin/requests?page=1&limit=20
 * ListJob一覧をUser情報とCollectedUrl数とともに返す
 * 新しい順でページネーション
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
        include: {
          _count: {
            select: { urls: true },
          },
        },
      }),
      prisma.listJob.count(),
    ]);

    // ユーザーIDを収集
    const userIds = Array.from(new Set(jobs.map((j) => j.userId)));

    // LineUser 情報を取得（displayName, lineUserId）
    const lineUsers = await prisma.lineUser.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, lineUserId: true, displayName: true },
    });
    const lineUserMap = new Map(lineUsers.map((lu) => [lu.userId, lu]));

    // シリョログUserデータを取得（User.id = ListJob.userId）
    let shiryologUserMap: Record<string, ShiryologUser> = {};

    if (userIds.length > 0) {
      try {
        const shiryologUsers = await prisma.$queryRaw<ShiryologUser[]>`
          SELECT id, name, email, "companyName", phone
          FROM "public"."User"
          WHERE id = ANY(${userIds}::text[])
        `;
        shiryologUserMap = Object.fromEntries(
          shiryologUsers.map((u) => [u.id, u])
        );
      } catch (err) {
        // シリョログUserテーブルが参照できない場合は無視
        console.warn('Failed to fetch shiryolog users:', err);
      }
    }

    const jobsWithUser = jobs.map((job) => {
      const lu = lineUserMap.get(job.userId);
      return {
        ...job,
        user: {
          id: job.userId,
          displayName: lu?.displayName ?? null,
          lineUserId: lu?.lineUserId ?? null,
          userId: job.userId,
          shiryologUser: shiryologUserMap[job.userId] ?? null,
        },
      };
    });

    return NextResponse.json({
      jobs: jobsWithUser,
      total,
      page,
    });
  } catch (error) {
    console.error('GET /api/admin/requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
