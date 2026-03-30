import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // 現在の残高
  const user = await prismaShiryolog.user.findUnique({
    where: { id: userId },
    select: { autolistCredits: true },
  })

  // 購入履歴（Purchaseテーブル）
  const purchases = await prisma.purchase.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, credits: true, createdAt: true },
  })

  // 利用履歴（ListJobテーブル）
  const jobs = await prisma.listJob.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      keyword: true,
      industry: true,
      location: true,
      targetCount: true,
      totalFound: true,
      reservedCredits: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  })

  // 統合して時系列ソート
  const history: Array<{
    type: 'purchase' | 'usage' | 'refund'
    date: string
    credits: number
    description: string
    amount?: number
  }> = []

  for (const p of purchases) {
    history.push({
      type: 'purchase',
      date: p.createdAt.toISOString(),
      credits: p.credits,
      description: 'クレジットチャージ',
      amount: p.amount,
    })
  }

  for (const j of jobs) {
    // completedジョブ: 実際の利用数 = totalFound（結果件数）
    if (j.status === 'completed' && j.totalFound > 0) {
      history.push({
        type: 'usage',
        date: (j.completedAt || j.createdAt).toISOString(),
        credits: -j.totalFound,
        description: `${j.keyword || ''}${j.location ? ` ${j.location}` : ''}${j.industry ? ` ${j.industry}` : ''}`,
      })

      // 未使用分返却: reservedCredits - totalFound（予約分より結果が少ない場合）
      const returned = j.reservedCredits - j.totalFound
      if (returned > 0) {
        history.push({
          type: 'refund',
          date: (j.completedAt || j.createdAt).toISOString(),
          credits: returned,
          description: `未使用分返却（${j.keyword || ''})`,
        })
      }
    } else if (j.status === 'processing' || j.status === 'pending') {
      // 処理中のジョブ: 予約分を表示
      if (j.reservedCredits > 0) {
        history.push({
          type: 'usage',
          date: j.createdAt.toISOString(),
          credits: -j.reservedCredits,
          description: `${j.keyword || ''}（処理中）`,
        })
      }
    }
  }

  // 日付降順ソート
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({
    currentCredits: user?.autolistCredits ?? 0,
    history,
  })
}
