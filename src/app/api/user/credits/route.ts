import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prismaShiryolog.user.findUnique({
    where: { id: session.user.id },
    select: { autolistCredits: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'ユーザーが見つかりません', credits: 0 },
      { status: 400 }
    )
  }

  return NextResponse.json({ credits: user.autolistCredits })
}
