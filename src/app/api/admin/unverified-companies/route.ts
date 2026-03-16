import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const take = Math.min(parseInt(searchParams.get('take') ?? '100', 10), 200)

  const unverified = await prisma.collectedUrl.findMany({
    where: { hasForm: true, companyVerified: false },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      job: {
        select: {
          keyword: true,
          createdAt: true,
          userId: true,
        },
      },
    },
  })

  const total = await prisma.collectedUrl.count({
    where: { hasForm: true, companyVerified: false },
  })

  const verifiedTotal = await prisma.collectedUrl.count({
    where: { hasForm: true, companyVerified: true },
  })

  return NextResponse.json({ unverified, total, verifiedTotal })
}
