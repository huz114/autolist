import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
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

  // User からクレジット取得
  const user = await prismaShiryolog.user.findUnique({
    where: { id: session.user.id },
    select: { autolistCredits: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'ユーザーが見つかりません' },
      { status: 400 }
    )
  }

  // クレジット残量チェック
  if ((user.autolistCredits ?? 0) < targetCount) {
    return NextResponse.json(
      {
        error: 'クレジットが不足しています',
        credits: user.autolistCredits ?? 0,
        required: targetCount,
      },
      { status: 400 }
    )
  }

  // ジョブ作成 + クレジット仮押さえ
  const keyword = `${location} ${industry}`
  const reservedCredits = targetCount

  const job = await prisma.listJob.create({
    data: {
      userId: session.user.id,
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
  })

  // クレジット仮押さえ（User テーブル）
  await prismaShiryolog.user.update({
    where: { id: session.user.id },
    data: {
      autolistCredits: { decrement: reservedCredits },
    },
  })

  // SearchLog記録
  await prisma.searchLog.create({
    data: {
      userId: session.user.id,
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
