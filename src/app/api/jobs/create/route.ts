import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { startProcessingIfNeeded } from '@/lib/job-poller'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { industry: string; location: string; targetCount: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { industry, location, targetCount } = body

  // バリデーション
  if (!industry || !location) {
    return NextResponse.json(
      { error: '業種と地域は必須です' },
      { status: 400 }
    )
  }

  if (!targetCount || targetCount < 10 || targetCount > 100 || targetCount % 10 !== 0) {
    return NextResponse.json(
      { error: '件数は10〜100件の範囲で、10件単位で指定してください' },
      { status: 400 }
    )
  }

  // session.user.id は shiryolog の User ID
  // LineUser.userId でリンクされている
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  })

  if (!lineUser) {
    return NextResponse.json(
      { error: 'LINEアカウントが連携されていません' },
      { status: 400 }
    )
  }

  // クレジット残量チェック
  if (lineUser.credits < targetCount) {
    return NextResponse.json(
      {
        error: 'クレジットが不足しています',
        credits: lineUser.credits,
        required: targetCount,
      },
      { status: 400 }
    )
  }

  // ジョブ作成 + クレジット仮押さえ（トランザクション）
  const keyword = `${location} ${industry}`
  const reservedCredits = targetCount

  const [job] = await prisma.$transaction([
    prisma.listJob.create({
      data: {
        userId: lineUser.id,
        keyword,
        industry,
        location,
        targetCount,
        reservedCredits,
        status: 'pending',
        source: 'web',
        originalMessage: `[Web] ${industry} ${location} ${targetCount}件`,
        industryKeywords: [],
      },
    }),
    prisma.lineUser.update({
      where: { id: lineUser.id },
      data: {
        credits: { decrement: reservedCredits },
      },
    }),
  ])

  // SearchLog記録
  await prisma.searchLog.create({
    data: {
      userId: lineUser.id,
      keyword,
      industry,
      location,
      targetCount,
      jobId: job.id,
    },
  })

  // ジョブ処理起動
  startProcessingIfNeeded().catch(error => {
    console.error('Failed to trigger job processing:', error)
  })

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      industry: job.industry,
      location: job.location,
      targetCount: job.targetCount,
      status: job.status,
      source: job.source,
      createdAt: job.createdAt,
    },
  })
}
