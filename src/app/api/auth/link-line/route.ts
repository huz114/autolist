import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { lineUserId } = await req.json()

  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserIdが必要です' }, { status: 400 })
  }

  const result = await prisma.lineUser.updateMany({
    where: { lineUserId, userId: null },
    data: { userId: session.user.id },
  })

  if (result.count === 0) {
    // 既に紐づき済みか、該当ユーザーが存在しない
    return NextResponse.json({ ok: true, linked: false })
  }

  return NextResponse.json({ ok: true, linked: true })
}
