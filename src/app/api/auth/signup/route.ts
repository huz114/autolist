import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, jobId } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    }

    // メール形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      )
    }

    // メール重複チェック
    const existing = await prismaShiryolog.user.findUnique({ where: { email } })
    if (existing) {
      if (existing.emailVerified) {
        // 認証済みユーザーは登録済みエラー
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        )
      } else {
        // 未認証ユーザーは削除して再登録を許可
        await prismaShiryolog.verificationToken.deleteMany({
          where: { email },
        })
        await prismaShiryolog.user.delete({
          where: { id: existing.id },
        })
      }
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await prismaShiryolog.user.create({
      data: { email, password: hashed, name },
    })

    // 認証トークン生成 & 保存
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間

    await prismaShiryolog.verificationToken.create({
      data: {
        token,
        email,
        expires,
      },
    })

    // 確認メール送信（失敗してもユーザー作成は維持）
    const emailResult = await sendVerificationEmail(email, token)
    if (!emailResult.success) {
      console.error('Verification email failed:', emailResult.error)
    }

    // jobIdがある場合、そのジョブのユーザーのLineUserと紐づける
    if (jobId) {
      const job = await prisma.listJob.findUnique({
        where: { id: jobId },
        select: { userId: true },
      })
      if (job?.userId) {
        // ジョブの userId で LineUser を検索して紐づける
        // （LINE-only ユーザーの仮 User → 正式 User への移行）
        await prisma.lineUser.updateMany({
          where: { userId: job.userId },
          data: { userId: user.id },
        })
        // ジョブの userId も新しい User.id に更新
        await prisma.listJob.updateMany({
          where: { userId: job.userId },
          data: { userId: user.id },
        })
        // Purchase も同様に更新
        await prisma.purchase.updateMany({
          where: { userId: job.userId },
          data: { userId: user.id },
        })
      }
    }

    return NextResponse.json(
      {
        message: '確認メールを送信しました。メールをご確認ください。',
        requiresVerification: true,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'アカウントの作成に失敗しました' },
      { status: 500 }
    )
  }
}
