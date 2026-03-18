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

  // ジョブの所有権確認 & キャンセル可能なステータスかチェック
  const job = await prisma.listJob.findFirst({
    where: {
      id: jobId,
      user: { userId: session.user.id },
      status: { in: ['running', 'pending'] },
    },
  })

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found or not cancellable' },
      { status: 404 }
    )
  }

  // ステータスをcancelledに変更
  await prisma.listJob.update({
    where: { id: jobId },
    data: { status: 'cancelled' },
  })

  return NextResponse.json({ success: true })
}
