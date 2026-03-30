import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = params

  let body: {
    subject: string
    body: string
    senderInfo: {
      name: string
      furigana: string
      email: string
      phone: string
      companyName: string
      address?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { subject, body: messageBody, senderInfo } = body

  if (!subject?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: '件名と本文は必須です' }, { status: 400 })
  }

  if (!senderInfo?.name?.trim() || !senderInfo?.companyName?.trim()) {
    return NextResponse.json({ error: '送信者情報（会社名・担当者名）は必須です' }, { status: 400 })
  }

  // ジョブの所有権確認（User.id で直接検索、確定済みジョブのみ）
  const job = await prisma.listJob.findFirst({
    where: {
      id: jobId,
      userId: session.user.id,
      status: 'completed',
      confirmedAt: { not: null },
    },
    include: {
      urls: {
        where: {
          hasForm: true,
          companyVerified: true,
          excluded: false,
        },
      },
    },
  })

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found or not confirmed' },
      { status: 404 }
    )
  }

  const companies = job.urls

  if (companies.length === 0) {
    return NextResponse.json(
      { error: 'No confirmed companies found' },
      { status: 400 }
    )
  }

  // fillEntries を構築
  const fillEntries = companies.map((company) => ({
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
      address: senderInfo.address || '',
    },
    timestamp: Date.now(),
  }))

  // ユニークなフォームURL
  const urls = fillEntries
    .map((e) => e.formUrl)
    .filter((url): url is string => Boolean(url))

  return NextResponse.json({ fillEntries, urls })
}
