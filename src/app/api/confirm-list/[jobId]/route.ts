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
  const body = await request.json()
  const excludedIds: string[] = body.excludedIds || []

  // ジョブの所有権確認
  const job = await prisma.listJob.findFirst({
    where: {
      id: jobId,
      user: { userId: session.user.id },
      status: { in: ['completed', 'failed'] },
      confirmedAt: null, // 未確定のみ
    },
    include: {
      urls: {
        where: { hasForm: true, companyVerified: true },
        select: { id: true },
      },
      user: true,
    },
  })

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found or already confirmed' },
      { status: 404 }
    )
  }

  // 除外フラグをDBに反映
  if (excludedIds.length > 0) {
    await prisma.collectedUrl.updateMany({
      where: {
        id: { in: excludedIds },
        jobId: jobId,
      },
      data: { excluded: true },
    })
  }

  // 確定企業数を算出（除外されていない企業）
  const confirmedCount = job.urls.length - excludedIds.length

  if (confirmedCount <= 0) {
    return NextResponse.json(
      { error: 'No companies remaining after exclusion' },
      { status: 400 }
    )
  }

  // 除外分のクレジットを返却 & confirmedAt設定
  // クレジットは依頼時に仮押さえ済み → 除外分だけ返却
  const refundCredits = excludedIds.length

  const transactionOps = [
    prisma.listJob.update({
      where: { id: jobId },
      data: {
        confirmedAt: new Date(),
        totalFound: confirmedCount,
      },
    }),
  ]

  if (refundCredits > 0) {
    transactionOps.push(
      prisma.lineUser.update({
        where: { id: job.userId },
        data: {
          credits: { increment: refundCredits },
          monthlyCount: { decrement: refundCredits },
        },
      }) as any
    )
  }

  await prisma.$transaction(transactionOps)

  return NextResponse.json({
    success: true,
    confirmedCount,
    creditsRefunded: refundCredits,
  })
}
