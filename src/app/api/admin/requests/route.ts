import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ShiryologUser = {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  phone: string | null;
};

/**
 * GET /api/admin/requests?page=1&limit=20
 * ListJob一覧をLineUser（displayName）とCollectedUrl数とともに返す
 * 新しい順でページネーション
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
          user: {
            select: {
              id: true,
              displayName: true,
              lineUserId: true,
              userId: true,
            },
          },
          _count: {
            select: { urls: true },
          },
        },
      }),
      prisma.listJob.count(),
    ]);

    // シリョログUserデータを取得（LineUser.userId = public.User.id）
    const userIds = Array.from(new Set(jobs.map((j) => j.user.userId).filter((id): id is string => id != null)));
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

    const jobsWithShiryologUser = jobs.map((job) => ({
      ...job,
      user: {
        ...job.user,
        shiryologUser: (job.user.userId && shiryologUserMap[job.user.userId]) ?? null,
      },
    }));

    return NextResponse.json({
      jobs: jobsWithShiryologUser,
      total,
      page,
    });
  } catch (error) {
    console.error('GET /api/admin/requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
