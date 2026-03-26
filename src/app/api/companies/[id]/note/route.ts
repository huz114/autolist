import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = session.user.id

  // CollectedUrlの存在確認
  const collectedUrl = await prisma.collectedUrl.findUnique({
    where: { id },
    select: { id: true, jobId: true },
  })
  if (!collectedUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ユーザーのジョブかチェック
  const job = await prisma.listJob.findFirst({
    where: { id: collectedUrl.jobId, userId },
    select: { id: true },
  })
  if (!job) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { memo } = body

  if (typeof memo !== 'string') {
    return NextResponse.json({ error: 'memo is required' }, { status: 400 })
  }

  // メモが空文字の場合は削除
  if (memo.trim() === '') {
    await prisma.companyNote.deleteMany({
      where: { userId, collectedUrlId: id },
    })
    return NextResponse.json({ note: null })
  }

  // upsert
  const note = await prisma.companyNote.upsert({
    where: {
      userId_collectedUrlId: { userId, collectedUrlId: id },
    },
    update: { memo },
    create: {
      userId,
      collectedUrlId: id,
      memo,
    },
  })

  return NextResponse.json({ note })
}
