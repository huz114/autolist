import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/search-logs?page=1&limit=20
 * searchQueriesが保存されているListJobの一覧を返す
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
          user: {
            select: {
              displayName: true,
              lineUserId: true,
            },
          },
        },
      }),
      prisma.listJob.count(),
    ]);

    return NextResponse.json({ jobs, total, page });
  } catch (error) {
    console.error('GET /api/admin/search-logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
