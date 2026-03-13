import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function POST(req: NextRequest) {
  const { email, password, name, jobId } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
  }

  const existing = await prismaShiryolog.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prismaShiryolog.user.create({
    data: { email, password: hashed, name },
  })

  // jobIdがある場合、そのジョブのLineUserと紐づける
  if (jobId) {
    const job = await prisma.listJob.findUnique({
      where: { id: jobId },
      include: { user: true },
    })
    if (job?.user) {
      await prisma.lineUser.update({
        where: { id: job.user.id },
        data: { userId: user.id },
      })
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
