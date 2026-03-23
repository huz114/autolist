import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  })

  if (!lineUser) {
    return NextResponse.json(
      { error: 'LINEアカウントが連携されていません', purchases: [] },
      { status: 400 }
    )
  }

  const purchases = await prisma.purchase.findMany({
    where: { userId: lineUser.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      credits: true,
      stripeId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ purchases })
}
