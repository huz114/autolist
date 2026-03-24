import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find LineUser linked to this user
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  })

  if (!lineUser) {
    return NextResponse.json({ error: 'LINE連携が見つかりません' }, { status: 404 })
  }

  // Remove the link (set userId to null)
  await prisma.lineUser.update({
    where: { id: lineUser.id },
    data: { userId: null },
  })

  return NextResponse.json({ success: true })
}
