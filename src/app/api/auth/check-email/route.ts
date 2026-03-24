import { NextRequest, NextResponse } from 'next/server'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ exists: false, verified: false })
  }

  const user = await prismaShiryolog.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  })

  if (!user) {
    return NextResponse.json({ exists: false, verified: false })
  }

  return NextResponse.json({
    exists: true,
    verified: !!user.emailVerified,
  })
}
