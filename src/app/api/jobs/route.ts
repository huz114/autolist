import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await prisma.listJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      urls: {
        select: { hasForm: true, companyVerified: true, excluded: true },
      },
      _count: {
        select: {
          urls: { where: { excluded: true } },
        },
      },
    },
  })

  return NextResponse.json({ jobs })
}
