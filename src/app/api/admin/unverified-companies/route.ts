import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未認証です' }, { status: 401 })
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email ?? '')) {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
  }

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
