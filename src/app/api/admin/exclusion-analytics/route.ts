import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/exclusion-analytics
 * 除外分析データをまとめて返す
 */
export async function GET(): Promise<NextResponse> {
  try {
    // --- 全体サマリー ---
    const [totalExcluded, totalCollected, confirmedJobs] = await Promise.all([
      prisma.collectedUrl.count({ where: { excluded: true } }),
      prisma.collectedUrl.count(),
      prisma.listJob.count({ where: { confirmedAt: { not: null } } }),
    ]);

    const exclusionRate = totalCollected > 0
      ? Math.round((totalExcluded / totalCollected) * 10000) / 100
      : 0;

    // --- 頻出除外ドメインランキング TOP 20 ---
    const topDomains = await prisma.collectedUrl.groupBy({
      by: ['domain'],
      where: { excluded: true },
      _count: { domain: true },
      orderBy: { _count: { domain: 'desc' } },
      take: 20,
    });

    const domainRanking = topDomains.map((d) => ({
      domain: d.domain,
      count: d._count.domain,
    }));

    // --- 業種別除外率 ---
    // ListJobのindustryごとにCollectedUrlの除外数と総数を集計
    const jobsWithCounts = await prisma.listJob.findMany({
      where: { industry: { not: null } },
      select: {
        industry: true,
        urls: {
          select: { excluded: true },
        },
      },
    });

    // 業種別に集計
    const industryMap = new Map<string, { excluded: number; total: number }>();
    for (const job of jobsWithCounts) {
      const industry = job.industry!;
      const entry = industryMap.get(industry) ?? { excluded: 0, total: 0 };
      for (const url of job.urls) {
        entry.total++;
        if (url.excluded) entry.excluded++;
      }
      industryMap.set(industry, entry);
    }

    const industryStats = Array.from(industryMap.entries())
      .map(([industry, stats]) => ({
        industry,
        excluded: stats.excluded,
        total: stats.total,
        rate: stats.total > 0
          ? Math.round((stats.excluded / stats.total) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // --- 最近の除外企業一覧（直近50件）---
    const recentExcluded = await prisma.collectedUrl.findMany({
      where: { excluded: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        companyName: true,
        domain: true,
        createdAt: true,
        job: {
          select: { industry: true },
        },
      },
    });

    const recentList = recentExcluded.map((u) => ({
      companyName: u.companyName,
      domain: u.domain,
      industry: u.job.industry,
      excludedAt: u.createdAt,
    }));

    return NextResponse.json({
      summary: {
        totalExcluded,
        totalCollected,
        exclusionRate,
        confirmedJobs,
      },
      domainRanking,
      industryStats,
      recentExcluded: recentList,
    });
  } catch (error) {
    console.error('GET /api/admin/exclusion-analytics error:', error);
    return NextResponse.json(
      {
        summary: { totalExcluded: 0, totalCollected: 0, exclusionRate: 0, confirmedJobs: 0 },
        domainRanking: [],
        industryStats: [],
        recentExcluded: [],
        _error: String(error),
      },
      { status: 200 }
    );
  }
}
