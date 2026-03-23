import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  })

  if (lineUser) {
    return NextResponse.json({
      linked: true,
      displayName: lineUser.displayName,
      lineUserId: lineUser.lineUserId,
    })
  }

  return NextResponse.json({ linked: false })
}
