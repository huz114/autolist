import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/extension/notifications
 * Chrome拡張向け: 最近完了したジョブの通知を返す
 * - 過去24時間以内に完了したジョブ
 * - ユーザーのジョブのみ
 * - seenAt が null のもの（未読）をカウント
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // User.id で直接 ListJob を検索
  const completedJobs = await prisma.listJob.findMany({
    where: {
      userId: session.user.id,
      status: 'completed',
      completedAt: {
        gte: oneDayAgo,
      },
    },
    select: {
      id: true,
      industry: true,
      location: true,
      totalFound: true,
      completedAt: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
    take: 20,
  })

  // chrome.storage に seenNotificationIds を保存する方式のため、
  // サーバー側では全件返し、既読管理はクライアント側で行う
  const notifications = completedJobs.map((job) => ({
    jobId: job.id,
    industry: job.industry || '不明',
    location: job.location || '不明',
    count: job.totalFound,
    completedAt: job.completedAt?.toISOString() || null,
  }))

  return NextResponse.json({
    notifications,
    unreadCount: notifications.length,
  })
}
