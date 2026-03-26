import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const body = await req.json()
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'ids array is required' },
      { status: 400 }
    )
  }

  // ユーザーのジョブに属するCollectedUrlのみ更新する
  const userJobIds = await prisma.listJob.findMany({
    where: { userId },
    select: { id: true },
  })
  const jobIdSet = new Set(userJobIds.map((j) => j.id))

  // 対象URLを確認
  const targets = await prisma.collectedUrl.findMany({
    where: { id: { in: ids } },
    select: { id: true, jobId: true },
  })

  const validIds = targets
    .filter((t) => jobIdSet.has(t.jobId))
    .map((t) => t.id)

  if (validIds.length === 0) {
    return NextResponse.json(
      { error: 'No valid IDs found' },
      { status: 404 }
    )
  }

  // downloadedAt を更新
  const result = await prisma.collectedUrl.updateMany({
    where: { id: { in: validIds } },
    data: { downloadedAt: new Date() },
  })

  return NextResponse.json({ updated: result.count })
}
