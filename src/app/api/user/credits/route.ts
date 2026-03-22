import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // session.user.id は shiryolog の User ID
  // LineUser.userId でリンクされている
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  })

  if (!lineUser) {
    return NextResponse.json(
      { error: 'LINEアカウントが連携されていません', credits: 0 },
      { status: 400 }
    )
  }

  return NextResponse.json({ credits: lineUser.credits })
}
