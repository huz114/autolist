import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

// GET: 前回メッセージ取得
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 })
  }

  const user = await prismaShiryolog.user.findUnique({
    where: { id: session.user.id },
    select: {
      lastSubject: true,
      lastBody: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ lastSubject: user.lastSubject, lastBody: user.lastBody })
}

// POST: 前回メッセージ保存
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 })
  }

  const body = await req.json()
  const { subject, body: messageBody } = body

  if (!subject || !messageBody) {
    return NextResponse.json({ error: '件名と本文は必須です' }, { status: 400 })
  }

  await prismaShiryolog.user.update({
    where: { id: session.user.id },
    data: {
      lastSubject: subject,
      lastBody: messageBody,
    },
  })

  return NextResponse.json({ ok: true })
}
