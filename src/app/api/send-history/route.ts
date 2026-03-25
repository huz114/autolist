import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const perPage = Math.min(50, Math.max(1, Number(searchParams.get('per_page')) || 20))
  const companyName = searchParams.get('company_name') || ''
  const status = searchParams.get('status') || ''

  // WHERE条件を構築
  const where: {
    userId: string
    companyName?: { contains: string; mode: 'insensitive' }
    status?: string
  } = {
    userId: session.user.id,
  }

  if (companyName.trim()) {
    where.companyName = { contains: companyName.trim(), mode: 'insensitive' }
  }

  if (status.trim()) {
    where.status = status.trim()
  }

  // 総件数
  const total = await prisma.sendRecord.count({ where })
  const totalPages = Math.ceil(total / perPage)

  // 送信履歴取得
  const records = await prisma.sendRecord.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
  })

  // 統計
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(now)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const [allTime, thisWeek, thisMonth] = await Promise.all([
    prisma.sendRecord.count({ where: { userId: session.user.id } }),
    prisma.sendRecord.count({
      where: { userId: session.user.id, sentAt: { gte: weekAgo } },
    }),
    prisma.sendRecord.count({
      where: { userId: session.user.id, sentAt: { gte: monthAgo } },
    }),
  ])

  const submissions = records.map((r) => ({
    id: r.id,
    formUrl: r.formUrl || '',
    subject: r.subject,
    messageBody: r.messageBody,
    status: r.status,
    submittedAt: r.sentAt.toISOString(),
    source: 'autolist',
    companyName: r.companyName,
    domain: r.companyDomain,
  }))

  return NextResponse.json({
    submissions,
    pagination: { page, per_page: perPage, total, total_pages: totalPages },
    stats: { thisWeek, thisMonth, allTime },
  })
}
