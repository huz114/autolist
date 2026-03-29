import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { searchParams } = new URL(req.url)

  // クエリパラメータ
  const industry = searchParams.get('industry')
  const location = searchParams.get('location')
  const status = searchParams.get('status') || 'all' // all/unsent/sent/dl
  const hasPhone = searchParams.get('hasPhone')
  const hasNote = searchParams.get('hasNote')
  const isArchived = searchParams.get('isArchived') === 'true'
  const search = searchParams.get('search')
  const sort = searchParams.get('sort') || 'richness'

  // ユーザーの全ListJobのIDを取得
  const userJobs = await prisma.listJob.findMany({
    where: { userId },
    select: { id: true, keyword: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const jobIds = userJobs.map((j) => j.id)

  if (jobIds.length === 0) {
    return NextResponse.json({
      companies: [],
      stats: { total: 0, hasForm: 0, sent: 0, downloaded: 0 },
    })
  }

  // jobId -> ソース情報マッピング
  const jobInfoMap = new Map(
    userJobs.map((j) => [
      j.id,
      {
        keyword: j.keyword,
        date: j.createdAt.toISOString().split('T')[0],
      },
    ])
  )

  // CollectedUrl + CompanyNote を取得
  const collectedUrls = await prisma.collectedUrl.findMany({
    where: {
      jobId: { in: jobIds },
      excluded: false,
    },
    include: {
      companyNotes: {
        where: { userId },
        take: 1,
      },
      job: {
        select: { id: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // SendRecordを取得（domain or companyName で突合）
  const sendRecords = await prisma.sendRecord.findMany({
    where: {
      userId,
      jobId: { in: jobIds },
    },
    orderBy: { sentAt: 'desc' },
  })
  interface SentInfo {
    sentAt: Date
    subject: string | null
    messageBody: string | null
  }
  const sentByDomain = new Map<string, SentInfo>()
  const sentByName = new Map<string, SentInfo>()
  for (const sr of sendRecords) {
    const info: SentInfo = { sentAt: sr.sentAt, subject: sr.subject, messageBody: sr.messageBody }
    if (sr.companyDomain && !sentByDomain.has(sr.companyDomain)) {
      sentByDomain.set(sr.companyDomain, info)
    }
    if (sr.companyName && !sentByName.has(sr.companyName)) {
      sentByName.set(sr.companyName, info)
    }
  }

  // domain単位で重複排除（最新のジョブのデータを採用）
  const domainMap = new Map<string, typeof collectedUrls[number]>()
  for (const url of collectedUrls) {
    const domain = url.domain
    const existing = domainMap.get(domain)
    if (!existing || url.job.createdAt > existing.job.createdAt) {
      domainMap.set(domain, url)
    }
  }

  // 企業データ整形
  let companies = Array.from(domainMap.values()).map((url) => {
    const note = url.companyNotes[0] || null
    const sentInfo = sentByDomain.get(url.domain) || sentByName.get(url.companyName || '') || null
    const sentAt = sentInfo?.sentAt || null
    const jobInfo = jobInfoMap.get(url.jobId)

    // 情報充実度スコア（richness）
    const richnessScore = [
      url.companyName,
      url.phoneNumber,
      url.email,
      url.representativeName,
      url.establishedYear,
      url.employeeCount,
      url.capitalAmount,
      url.businessDescription,
      url.hasForm,
      url.industry,
      url.location,
      url.snsLinks,
      url.officers,
    ].filter(Boolean).length

    return {
      id: url.id,
      companyName: url.companyName,
      domain: url.domain,
      url: url.url,
      industry: url.industry,
      industryMajor: url.industryMajor,
      location: url.location,
      phoneNumber: url.phoneNumber,
      email: url.email,
      representativeName: url.representativeName,
      establishedYear: url.establishedYear,
      employeeCount: url.employeeCount,
      capital: url.capitalAmount,
      businessDescription: url.businessDescription,
      hasForm: url.hasForm,
      formUrl: url.formUrl,
      isPinned: url.isPinned,
      isArchived: url.isArchived,
      downloadedAt: url.downloadedAt,
      sentAt,
      sentSubject: sentInfo?.subject || null,
      sentMessageBody: sentInfo?.messageBody || null,
      note: note?.memo || null,
      noteUpdatedAt: note?.updatedAt || null,
      sourceJob: jobInfo?.keyword || '',
      sourceDate: jobInfo?.date || '',
      jobKeyword: jobInfo?.keyword || null,
      jobCreatedAt: jobInfo?.date || null,
      richnessScore,
    }
  })

  // フィルタリング
  if (industry) {
    companies = companies.filter(
      (c) =>
        c.industry?.includes(industry) ||
        c.industryMajor?.includes(industry)
    )
  }
  if (location) {
    companies = companies.filter((c) => c.location?.includes(location))
  }
  if (status === 'unsent') {
    companies = companies.filter((c) => !c.sentAt)
  } else if (status === 'sent') {
    companies = companies.filter((c) => c.sentAt !== null)
  } else if (status === 'dl') {
    companies = companies.filter((c) => c.downloadedAt !== null)
  }
  if (hasPhone === 'true') {
    companies = companies.filter((c) => c.phoneNumber)
  } else if (hasPhone === 'false') {
    companies = companies.filter((c) => !c.phoneNumber)
  }
  if (hasNote === 'true') {
    companies = companies.filter((c) => c.note !== null)
  } else if (hasNote === 'false') {
    companies = companies.filter((c) => c.note === null)
  }
  if (!isArchived) {
    companies = companies.filter((c) => !c.isArchived)
  } else {
    companies = companies.filter((c) => c.isArchived)
  }
  if (search) {
    const q = search.toLowerCase()
    companies = companies.filter(
      (c) =>
        c.companyName?.toLowerCase().includes(q) ||
        c.note?.toLowerCase().includes(q)
    )
  }

  // 統計（フィルタ前の全データで計算）
  const allCompanies = Array.from(domainMap.values())
  const stats = {
    total: allCompanies.filter((c) => !c.isArchived).length,
    hasForm: allCompanies.filter((c) => c.hasForm && !c.isArchived).length,
    sent: allCompanies.filter(
      (c) => (sentByDomain.has(c.domain) || sentByName.has(c.companyName || '')) && !c.isArchived
    ).length,
    downloaded: allCompanies.filter(
      (c) => c.downloadedAt !== null && !c.isArchived
    ).length,
  }

  // ソート: isPinned=true を常に最上位
  companies.sort((a, b) => {
    // ピン留め優先
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1

    switch (sort) {
      case 'name':
        return (a.companyName || '').localeCompare(b.companyName || '', 'ja')
      case 'location':
        return (a.location || '').localeCompare(b.location || '', 'ja')
      case 'date':
        return b.sourceDate.localeCompare(a.sourceDate)
      case 'richness':
      default:
        return b.richnessScore - a.richnessScore
    }
  })

  // richnessScore はレスポンスから除外
  const response = companies.map(({ richnessScore, ...rest }) => rest)

  return NextResponse.json({ companies: response, stats })
}
