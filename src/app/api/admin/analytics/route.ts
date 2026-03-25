import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

/**
 * GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * マーケティング分析データをまとめて返す
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

    // 期間フィルター（fromとtoが両方指定された場合に適用）
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (fromStr) {
      const d = new Date(fromStr);
      fromDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    if (toStr) {
      const d = new Date(toStr);
      toDate = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59)
      );
    }

    const dateRange = fromDate && toDate ? { gte: fromDate, lte: toDate } : undefined;

    // 今月の開始日
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // --- Summary ---
    const [totalRevenueAgg, monthRevenueAgg, totalUsers, totalPurchases, allJobs] = await Promise.all([
      // Purchaseの合計金額（全期間）
      prisma.purchase.aggregate({
        _sum: { amount: true },
      }),
      // 今月のPurchase合計
      prisma.purchase.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // LineUser総数（LINE経由ユーザー数として維持）
      prisma.lineUser.count(),
      // Purchase総件数
      prisma.purchase.count(),
      // ListJob全件（完了率計算用）
      prisma.listJob.findMany({
        select: { status: true },
      }),
    ]);

    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter((j) => j.status === 'completed').length;
    const cancelledJobs = allJobs.filter((j) => j.status === 'cancelled').length;

    // --- Funnel（期間フィルター適用） ---
    const [jobsInRange, purchasesInRange, adMetricsAgg] = await Promise.all([
      // 期間内のListJob
      prisma.listJob.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        select: { status: true },
      }),
      // 期間内のPurchase件数
      prisma.purchase.count({
        where: dateRange ? { createdAt: dateRange } : undefined,
      }),
      // AdMetrics集計（期間フィルターはdate列に適用）
      prisma.adMetrics.aggregate({
        where: dateRange ? { date: dateRange } : undefined,
        _sum: { impressions: true, clicks: true },
      }),
    ]);

    const jobsCreated = jobsInRange.length;
    const jobsCompleted = jobsInRange.filter((j) => j.status === 'completed').length;

    // --- Daily（期間内の日次データ） ---
    let daily: { date: string; revenue: number; jobs: number; newUsers: number }[] = [];

    if (fromDate && toDate) {
      const [dailyPurchases, dailyJobs, dailyUsers] = await Promise.all([
        prisma.purchase.findMany({
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { createdAt: true, amount: true },
        }),
        prisma.listJob.findMany({
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { createdAt: true },
        }),
        prisma.lineUser.findMany({
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { createdAt: true },
        }),
      ]);

      const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

      const revMap = new Map<string, number>();
      for (const p of dailyPurchases) {
        const key = toDateKey(p.createdAt);
        revMap.set(key, (revMap.get(key) ?? 0) + p.amount);
      }

      const jobMap = new Map<string, number>();
      for (const j of dailyJobs) {
        const key = toDateKey(j.createdAt);
        jobMap.set(key, (jobMap.get(key) ?? 0) + 1);
      }

      const userMap = new Map<string, number>();
      for (const u of dailyUsers) {
        const key = toDateKey(u.createdAt);
        userMap.set(key, (userMap.get(key) ?? 0) + 1);
      }

      // 期間内の全日付を生成
      const dates: string[] = [];
      const cursor = new Date(fromDate);
      while (cursor <= toDate) {
        dates.push(toDateKey(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      daily = dates.map((date) => ({
        date,
        revenue: revMap.get(date) ?? 0,
        jobs: jobMap.get(date) ?? 0,
        newUsers: userMap.get(date) ?? 0,
      }));
    }

    // --- Campaigns（キャンペーン別集計） ---
    const campaignData = await prisma.adMetrics.groupBy({
      by: ['campaign'],
      where: dateRange ? { date: dateRange } : undefined,
      _sum: { impressions: true, clicks: true, spend: true },
    });

    const campaigns = campaignData.map((c) => {
      const impressions = c._sum.impressions ?? 0;
      const clicks = c._sum.clicks ?? 0;
      const spend = c._sum.spend ?? 0;
      const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      return {
        campaign: c.campaign,
        impressions,
        clicks,
        spend,
        ctr,
        cpc,
      };
    });

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenueAgg._sum.amount ?? 0,
        monthlyRevenue: monthRevenueAgg._sum.amount ?? 0,
        totalPurchases,
        totalUsers,
        totalJobs,
        completedJobs,
        cancelledJobs,
      },
      funnel: {
        richMenuClicks: adMetricsAgg._sum.clicks ?? 0,
        jobsCreated,
        jobsCompleted,
        purchases: purchasesInRange,
        shiryologSignups: 0, // 将来実装
      },
      daily,
      campaigns,
    });
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json(
      {
        summary: {
          totalRevenue: 0,
          monthlyRevenue: 0,
          totalPurchases: 0,
          totalUsers: 0,
          totalJobs: 0,
          completedJobs: 0,
          cancelledJobs: 0,
        },
        funnel: {
          richMenuClicks: 0,
          jobsCreated: 0,
          jobsCompleted: 0,
          purchases: 0,
          shiryologSignups: 0,
        },
        daily: [],
        campaigns: [],
        _error: String(error),
      },
      { status: 200 }
    );
  }
}
