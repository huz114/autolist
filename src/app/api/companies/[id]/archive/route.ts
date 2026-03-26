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

  // CollectedUrlの存在確認 + ユーザー所有チェック
  const collectedUrl = await prisma.collectedUrl.findUnique({
    where: { id },
    select: { id: true, jobId: true, isArchived: true },
  })
  if (!collectedUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const job = await prisma.listJob.findFirst({
    where: { id: collectedUrl.jobId, userId },
    select: { id: true },
  })
  if (!job) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // トグル
  const updated = await prisma.collectedUrl.update({
    where: { id },
    data: { isArchived: !collectedUrl.isArchived },
    select: { id: true, isArchived: true },
  })

  return NextResponse.json({ isArchived: updated.isArchived })
}
