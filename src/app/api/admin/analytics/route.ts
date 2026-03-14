import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * マーケティング分析データをまとめて返す
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
    const [totalRevenue, monthRevenue, totalUsers, allUsers] = await Promise.all([
      // Purchaseの合計金額（全期間）
      prisma.purchase.aggregate({
        _sum: { amount: true },
      }),
      // 今月のPurchase合計
      prisma.purchase.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // LineUser総数
      prisma.lineUser.count(),
      // リピートユーザー計算用（ListJobが2件以上のユーザー）
      prisma.lineUser.findMany({
        select: {
          id: true,
          _count: { select: { jobs: true } },
        },
      }),
    ]);

    const repeatUsers = allUsers.filter((u) => u._count.jobs >= 2).length;
    const repeatRate =
      allUsers.length > 0
        ? Math.round((repeatUsers / allUsers.length) * 100 * 10) / 10
        : 0;

    // --- Funnel（期間フィルター適用） ---
    const [adMetricsAgg, lineRegistrations, requests, purchasesInRange, revenueInRange] =
      await Promise.all([
        // AdMetrics集計
        prisma.adMetrics.aggregate({
          where: dateRange ? { date: dateRange } : undefined,
          _sum: { impressions: true, clicks: true },
        }),
        // 期間内のLineUser新規登録数
        prisma.lineUser.count({
          where: dateRange ? { createdAt: dateRange } : undefined,
        }),
        // 期間内のSearchLog件数
        prisma.searchLog.count({
          where: dateRange ? { createdAt: dateRange } : undefined,
        }),
        // 期間内のPurchase件数
        prisma.purchase.count({
          where: dateRange ? { createdAt: dateRange } : undefined,
        }),
        // 期間内のPurchase金額合計
        prisma.purchase.aggregate({
          where: dateRange ? { createdAt: dateRange } : undefined,
          _sum: { amount: true },
        }),
      ]);

    // --- Daily（期間内の日次データ） ---
    let daily: { date: string; registrations: number; requests: number; revenue: number }[] =
      [];

    if (fromDate && toDate) {
      // 日次LineUser登録
      const dailyRegistrations = await prisma.lineUser.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { id: true },
      });

      // 日次SearchLog
      const dailyRequests = await prisma.searchLog.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: { id: true },
      });

      // 日次Purchase金額
      const dailyPurchases = await prisma.purchase.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        select: { createdAt: true, amount: true },
      });

      // 日付ごとに集計するヘルパー
      const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

      const regMap = new Map<string, number>();
      for (const r of dailyRegistrations) {
        const key = toDateKey(r.createdAt);
        regMap.set(key, (regMap.get(key) ?? 0) + r._count.id);
      }

      const reqMap = new Map<string, number>();
      for (const r of dailyRequests) {
        const key = toDateKey(r.createdAt);
        reqMap.set(key, (reqMap.get(key) ?? 0) + r._count.id);
      }

      const revMap = new Map<string, number>();
      for (const p of dailyPurchases) {
        const key = toDateKey(p.createdAt);
        revMap.set(key, (revMap.get(key) ?? 0) + p.amount);
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
        registrations: regMap.get(date) ?? 0,
        requests: reqMap.get(date) ?? 0,
        revenue: revMap.get(date) ?? 0,
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
      return {
        campaign: c.campaign,
        impressions,
        clicks,
        spend,
        ctr,
      };
    });

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue._sum.amount ?? 0,
        monthRevenue: monthRevenue._sum.amount ?? 0,
        totalUsers,
        repeatUsers,
        repeatRate,
      },
      funnel: {
        adImpressions: adMetricsAgg._sum.impressions ?? 0,
        adClicks: adMetricsAgg._sum.clicks ?? 0,
        lineRegistrations,
        requests,
        purchases: purchasesInRange,
        revenue: revenueInRange._sum.amount ?? 0,
      },
      daily,
      campaigns,
    });
  } catch (error) {
    console.error('GET /api/admin/analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
