import { prisma } from '@/lib/prisma'
import { GeminiUsageClient } from './gemini-usage-client'

// --- Types shared with client ---
export interface SourceBreakdown {
  source: string
  count: number
  totalCost: number
  avgCost: number
}

export interface DailyUsage {
  date: string
  cost: number
  count: number
}

export interface JobUsage {
  jobId: string
  keyword: string
  industry: string | null
  location: string | null
  totalCost: number
  count: number
  sources: Record<string, number>
}

export interface GeminiUsageData {
  period: 'current' | 'previous'
  periodLabel: string
  totalCost: number
  totalRequests: number
  avgCostPerRequest: number
  topSource: string
  sourceBreakdown: SourceBreakdown[]
  daily: DailyUsage[]
  jobs: JobUsage[]
}

async function fetchUsageData(month: Date): Promise<GeminiUsageData> {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999)

  const isCurrentMonth =
    new Date().getFullYear() === month.getFullYear() &&
    new Date().getMonth() === month.getMonth()

  const periodLabel = `${month.getFullYear()}/${String(month.getMonth() + 1).padStart(2, '0')}`

  // 1. Source-level aggregation
  const sourceAgg = await prisma.geminiUsageLog.groupBy({
    by: ['source'],
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    },
    _count: { id: true },
    _sum: { estimatedCostJpy: true },
  })

  const sourceBreakdown: SourceBreakdown[] = sourceAgg.map((s) => ({
    source: s.source,
    count: s._count.id,
    totalCost: s._sum.estimatedCostJpy ?? 0,
    avgCost: s._count.id > 0 ? (s._sum.estimatedCostJpy ?? 0) / s._count.id : 0,
  }))

  const totalCost = sourceBreakdown.reduce((acc, s) => acc + s.totalCost, 0)
  const totalRequests = sourceBreakdown.reduce((acc, s) => acc + s.count, 0)
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0

  // Find top source by cost
  const topSource =
    sourceBreakdown.length > 0
      ? sourceBreakdown.reduce((a, b) => (a.totalCost > b.totalCost ? a : b)).source
      : '-'

  // 2. Daily aggregation (past 30 days from end of month, or all days in month)
  const thirtyDaysAgo = new Date(endOfMonth)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const dailyStart = thirtyDaysAgo > startOfMonth ? thirtyDaysAgo : startOfMonth

  const dailyLogs = await prisma.geminiUsageLog.findMany({
    where: {
      createdAt: { gte: dailyStart, lte: endOfMonth },
    },
    select: {
      createdAt: true,
      estimatedCostJpy: true,
    },
  })

  // Group by date string
  const dailyMap = new Map<string, { cost: number; count: number }>()
  for (const log of dailyLogs) {
    const dateStr = log.createdAt.toISOString().slice(0, 10)
    const existing = dailyMap.get(dateStr) || { cost: 0, count: 0 }
    existing.cost += log.estimatedCostJpy
    existing.count += 1
    dailyMap.set(dateStr, existing)
  }

  // Fill all dates in range
  const daily: DailyUsage[] = []
  const cursor = new Date(dailyStart)
  while (cursor <= endOfMonth) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const data = dailyMap.get(dateStr) || { cost: 0, count: 0 }
    daily.push({ date: dateStr, ...data })
    cursor.setDate(cursor.getDate() + 1)
  }

  // 3. Job-level aggregation (top 20 by cost)
  const jobAgg = await prisma.geminiUsageLog.groupBy({
    by: ['jobId'],
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      jobId: { not: null },
    },
    _sum: { estimatedCostJpy: true },
    _count: { id: true },
    orderBy: { _sum: { estimatedCostJpy: 'desc' } },
    take: 20,
  })

  const jobIds = jobAgg
    .map((j) => j.jobId)
    .filter((id): id is string => id !== null)

  // Fetch job details
  const jobDetails = await prisma.listJob.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, keyword: true, industry: true, location: true },
  })
  const jobMap = new Map(jobDetails.map((j) => [j.id, j]))

  // Fetch source breakdown per job
  const jobSourceLogs = await prisma.geminiUsageLog.groupBy({
    by: ['jobId', 'source'],
    where: {
      jobId: { in: jobIds },
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    },
    _sum: { estimatedCostJpy: true },
  })

  const jobSourceMap = new Map<string, Record<string, number>>()
  for (const log of jobSourceLogs) {
    if (!log.jobId) continue
    const existing = jobSourceMap.get(log.jobId) || {}
    existing[log.source] = log._sum.estimatedCostJpy ?? 0
    jobSourceMap.set(log.jobId, existing)
  }

  const jobs: JobUsage[] = jobAgg.map((j) => {
    const detail = j.jobId ? jobMap.get(j.jobId) : undefined
    return {
      jobId: j.jobId || '-',
      keyword: detail?.keyword || '-',
      industry: detail?.industry || null,
      location: detail?.location || null,
      totalCost: j._sum.estimatedCostJpy ?? 0,
      count: j._count.id,
      sources: j.jobId ? (jobSourceMap.get(j.jobId) || {}) : {},
    }
  })

  return {
    period: isCurrentMonth ? 'current' : 'previous',
    periodLabel,
    totalCost,
    totalRequests,
    avgCostPerRequest,
    topSource,
    sourceBreakdown,
    daily,
    jobs,
  }
}

export default async function GeminiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const now = new Date()

  // Determine which month to show
  let targetMonth: Date
  if (params.month === 'previous') {
    targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  } else {
    targetMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const data = await fetchUsageData(targetMonth)

  return <GeminiUsageClient data={data} />
}
