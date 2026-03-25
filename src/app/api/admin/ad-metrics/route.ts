import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * POST /api/admin/ad-metrics
 * 広告データを登録・更新する（同日・同キャンペーンはupsert）
 * Body: { date: string, campaign: string, impressions: number, clicks: number, spend: number }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 });
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email ?? '')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { date, campaign, impressions, clicks, spend } = body;

    if (!date || !campaign) {
      return NextResponse.json(
        { error: 'date and campaign are required' },
        { status: 400 }
      );
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // 日付を00:00:00 UTCに正規化
    const normalizedDate = new Date(
      Date.UTC(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate()
      )
    );

    const adMetrics = await prisma.adMetrics.upsert({
      where: {
        date_campaign: {
          date: normalizedDate,
          campaign,
        },
      },
      update: {
        impressions: impressions ?? 0,
        clicks: clicks ?? 0,
        spend: spend ?? 0,
      },
      create: {
        date: normalizedDate,
        campaign,
        impressions: impressions ?? 0,
        clicks: clicks ?? 0,
        spend: spend ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: adMetrics });
  } catch (error) {
    console.error('POST /api/admin/ad-metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/ad-metrics
 * 期間内の広告データを取得する
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
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
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    const where: { date?: { gte?: Date; lte?: Date } } = {};

    if (fromStr || toStr) {
      where.date = {};
      if (fromStr) {
        const from = new Date(fromStr);
        where.date.gte = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
        );
      }
      if (toStr) {
        const to = new Date(toStr);
        where.date.lte = new Date(
          Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59)
        );
      }
    }

    const adMetrics = await prisma.adMetrics.findMany({
      where,
      orderBy: [{ date: 'asc' }, { campaign: 'asc' }],
    });

    return NextResponse.json({ data: adMetrics });
  } catch (error) {
    console.error('GET /api/admin/ad-metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
