import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

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

  // 1. Get domains from user's confirmed jobs
  const lineUsers = await prisma.lineUser.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (lineUsers.length === 0) {
    return NextResponse.json({
      submissions: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      stats: { thisWeek: 0, thisMonth: 0, allTime: 0 },
    })
  }

  const lineUserIds = lineUsers.map((u) => u.id)

  // Get all domains from user's jobs
  const jobs = await prisma.listJob.findMany({
    where: { userId: { in: lineUserIds } },
    select: { id: true },
  })

  const jobIds = jobs.map((j) => j.id)

  if (jobIds.length === 0) {
    return NextResponse.json({
      submissions: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      stats: { thisWeek: 0, thisMonth: 0, allTime: 0 },
    })
  }

  const collectedUrls = await prisma.collectedUrl.findMany({
    where: {
      jobId: { in: jobIds },
      hasForm: true,
      companyVerified: true,
    },
    select: { domain: true },
    distinct: ['domain'],
  })

  const domains = collectedUrls.map((u) => u.domain)

  if (domains.length === 0) {
    return NextResponse.json({
      submissions: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      stats: { thisWeek: 0, thisMonth: 0, allTime: 0 },
    })
  }

  // 2. Get shiryolog Company IDs matching those domains
  const companies = await prismaShiryolog.company.findMany({
    where: { domain: { in: domains } },
    select: { id: true, domain: true },
  })

  const companyIds = companies.map((c) => c.id)

  if (companyIds.length === 0) {
    return NextResponse.json({
      submissions: [],
      pagination: { page, per_page: perPage, total: 0, total_pages: 0 },
      stats: { thisWeek: 0, thisMonth: 0, allTime: 0 },
    })
  }

  // 3. Build WHERE clause for FormSubmission query
  const companyIdPlaceholders = companyIds.map((_, i) => `$${i + 1}`).join(', ')
  const baseWhere = `WHERE fs.source = 'autolist' AND fs."companyId" IN (${companyIdPlaceholders})`

  const filterParams: string[] = [...companyIds]
  let extraWhere = ''

  if (companyName.trim()) {
    filterParams.push(`%${companyName.trim()}%`)
    extraWhere += ` AND c.name ILIKE $${filterParams.length}`
  }

  if (status.trim()) {
    filterParams.push(status.trim())
    extraWhere += ` AND fs.status = $${filterParams.length}`
  }

  const fullWhere = baseWhere + extraWhere

  // 4. Count total
  const countResult = await prismaShiryolog.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "FormSubmission" fs LEFT JOIN "Company" c ON fs."companyId" = c.id ${fullWhere}`,
    ...filterParams
  )
  const total = Number(countResult[0]?.count || 0)
  const totalPages = Math.ceil(total / perPage)

  // 5. Fetch submissions with pagination
  const offset = (page - 1) * perPage
  const submissions = await prismaShiryolog.$queryRawUnsafe<Array<{
    id: string
    formUrl: string
    subject: string | null
    messageBody: string | null
    status: string
    submittedAt: Date
    source: string
    companyName: string | null
    domain: string | null
  }>>(
    `SELECT fs.id, fs."formUrl", fs.subject, fs."messageBody", fs.status, fs."submittedAt", fs.source,
            c.name as "companyName", c.domain
     FROM "FormSubmission" fs
     LEFT JOIN "Company" c ON fs."companyId" = c.id
     ${fullWhere}
     ORDER BY fs."submittedAt" DESC
     LIMIT ${perPage} OFFSET ${offset}`,
    ...filterParams
  )

  // 6. Stats
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(now)
  monthAgo.setMonth(monthAgo.getMonth() - 1)

  const statsResult = await prismaShiryolog.$queryRawUnsafe<[{
    allTime: bigint
    thisWeek: bigint
    thisMonth: bigint
  }]>(
    `SELECT
       COUNT(*) as "allTime",
       COUNT(*) FILTER (WHERE fs."submittedAt" >= $${filterParams.length + 1}) as "thisWeek",
       COUNT(*) FILTER (WHERE fs."submittedAt" >= $${filterParams.length + 2}) as "thisMonth"
     FROM "FormSubmission" fs
     LEFT JOIN "Company" c ON fs."companyId" = c.id
     ${fullWhere}`,
    ...filterParams,
    weekAgo,
    monthAgo
  )

  const stats = {
    thisWeek: Number(statsResult[0]?.thisWeek || 0),
    thisMonth: Number(statsResult[0]?.thisMonth || 0),
    allTime: Number(statsResult[0]?.allTime || 0),
  }

  return NextResponse.json({
    submissions: submissions.map((s) => ({
      ...s,
      submittedAt: s.submittedAt instanceof Date ? s.submittedAt.toISOString() : s.submittedAt,
    })),
    pagination: { page, per_page: perPage, total, total_pages: totalPages },
    stats,
  })
}
