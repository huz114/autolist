import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

// GET: 送信者プロフィール取得
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 })
  }

  const user = await prismaShiryolog.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      companyName: true,
      companyUrl: true,
      phone: true,
      senderEmail: true,
      senderFurigana: true,
      senderTitle: true,
      senderAddress: true,
      senderPostalCode: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ user })
}

// POST: 送信者プロフィール保存
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 })
  }

  const body = await req.json()
  const { companyName, personName, furigana, phone, companyUrl, title, senderEmail, address, postalCode } = body

  if (!companyName || !personName) {
    return NextResponse.json({ error: '会社名と担当者名は必須です' }, { status: 400 })
  }

  const user = await prismaShiryolog.user.update({
    where: { id: session.user.id },
    data: {
      name: personName ?? undefined,
      companyName: companyName ?? undefined,
      phone: phone ?? undefined,
      companyUrl: companyUrl ?? undefined,
      senderEmail: senderEmail ?? undefined,
      senderFurigana: furigana ?? undefined,
      senderTitle: title ?? undefined,
      senderAddress: address ?? undefined,
      senderPostalCode: postalCode ?? undefined,
    },
    select: {
      email: true,
      name: true,
      companyName: true,
      companyUrl: true,
      phone: true,
      senderEmail: true,
      senderFurigana: true,
      senderTitle: true,
      senderAddress: true,
      senderPostalCode: true,
    },
  })

  return NextResponse.json({ user })
}
