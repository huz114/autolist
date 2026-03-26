import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    companyIds: string[]
    subject: string
    body: string
    senderInfo: {
      name: string
      furigana: string
      email: string
      phone: string
      companyName: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { companyIds, subject, body: messageBody, senderInfo } = body

  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json({ error: '送信先企業IDは必須です' }, { status: 400 })
  }

  if (!subject?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: '件名と本文は必須です' }, { status: 400 })
  }

  if (!senderInfo?.name?.trim() || !senderInfo?.companyName?.trim()) {
    return NextResponse.json({ error: '送信者情報（会社名・担当者名）は必須です' }, { status: 400 })
  }

  // companyIds から CollectedUrl を取得（hasForm=true, formUrl存在、ユーザー所有チェック）
  const companies = await prisma.collectedUrl.findMany({
    where: {
      id: { in: companyIds },
      hasForm: true,
      formUrl: { not: null },
      excluded: false,
      job: {
        userId: session.user.id,
      },
    },
    include: {
      job: { select: { id: true } },
    },
  })

  if (companies.length === 0) {
    return NextResponse.json(
      { error: '送信可能な企業が見つかりません' },
      { status: 400 }
    )
  }

  // 30日クールダウンチェック（SendRecordと突合）
  const cooldownDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const recentSendRecords = await prisma.sendRecord.findMany({
    where: {
      userId: session.user.id,
      sentAt: { gte: cooldownDate },
      formUrl: {
        in: companies
          .map((c) => c.formUrl)
          .filter((url): url is string => Boolean(url)),
      },
    },
    select: { formUrl: true },
  })

  const recentlySentFormUrls = new Set(
    recentSendRecords.map((r) => r.formUrl).filter(Boolean)
  )

  // クールダウン企業を除外
  const sendableCompanies = companies.filter(
    (c) => c.formUrl && !recentlySentFormUrls.has(c.formUrl)
  )
  const skippedCount = companies.length - sendableCompanies.length

  if (sendableCompanies.length === 0) {
    return NextResponse.json(
      { error: '全ての企業がクールダウン期間中です（送信後30日以内）', skippedCount },
      { status: 400 }
    )
  }

  // fillEntries を構築
  const fillEntries = sendableCompanies.map((company) => ({
    companyId: company.id,
    companyName: company.companyName || '',
    companyDomain: company.domain,
    formUrl: company.formUrl,
    salesCopy: { subject, body: messageBody },
    senderInfo: {
      name: senderInfo.name,
      email: senderInfo.email,
      phone: senderInfo.phone,
      furigana: senderInfo.furigana || '',
      companyName: senderInfo.companyName,
    },
    timestamp: Date.now(),
  }))

  // ユニークなフォームURL
  const urls = fillEntries
    .map((e) => e.formUrl)
    .filter((url): url is string => Boolean(url))

  // SendRecordに記録
  await prisma.sendRecord.createMany({
    data: sendableCompanies.map((company) => ({
      userId: session.user.id,
      jobId: company.job.id,
      companyName: company.companyName || null,
      companyDomain: company.domain || null,
      formUrl: company.formUrl || null,
      subject: subject || null,
      messageBody: messageBody || null,
      status: 'sent',
    })),
  })

  return NextResponse.json({
    fillEntries,
    urls,
    skippedCount,
    sentCount: sendableCompanies.length,
  })
}
