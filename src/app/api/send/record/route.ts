import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    jobId: string
    companyName?: string
    companyDomain?: string
    formUrl?: string
    subject?: string
    messageBody?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { jobId, companyName, companyDomain, formUrl, subject, messageBody } = body

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  // 重複チェック: 同じ jobId + formUrl の組み合わせは無視
  if (formUrl) {
    const existing = await prisma.sendRecord.findFirst({
      where: { jobId, formUrl, userId: session.user.id },
    })
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
  }

  const record = await prisma.sendRecord.create({
    data: {
      userId: session.user.id,
      jobId,
      companyName: companyName || null,
      companyDomain: companyDomain || null,
      formUrl: formUrl || null,
      subject: subject || null,
      messageBody: messageBody || null,
      status: 'sent',
    },
  })

  return NextResponse.json({ ok: true, id: record.id })
}
