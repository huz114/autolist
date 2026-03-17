import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
import { sendVerificationEmail } from '@/lib/email'

// レート制限用（メモリ内キャッシュ）
const lastSentMap = new Map<string, number>()

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      )
    }

    // レート制限: 60秒以内の再送不可
    const lastSent = lastSentMap.get(email)
    if (lastSent && Date.now() - lastSent < 60 * 1000) {
      const remaining = Math.ceil((60 * 1000 - (Date.now() - lastSent)) / 1000)
      return NextResponse.json(
        { error: `再送信は${remaining}秒後に可能です` },
        { status: 429 }
      )
    }

    // ユーザー存在 & 未認証チェック
    const user = await prismaShiryolog.user.findUnique({
      where: { email },
    })

    // セキュリティ: ユーザーの存在有無に関わらず同じレスポンスを返す
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message: 'メールアドレスが登録されている場合、確認メールを送信しました。',
      })
    }

    // 既存トークン削除
    await prismaShiryolog.verificationToken.deleteMany({
      where: { email },
    })

    // 新トークン生成
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間

    await prismaShiryolog.verificationToken.create({
      data: {
        token,
        email,
        expires,
      },
    })

    // メール送信
    const emailResult = await sendVerificationEmail(email, token)
    if (!emailResult.success) {
      console.error('Resend verification email failed:', emailResult.error)
    }

    // レート制限更新
    lastSentMap.set(email, Date.now())

    return NextResponse.json({
      message: 'メールアドレスが登録されている場合、確認メールを送信しました。',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: '確認メールの再送信に失敗しました' },
      { status: 500 }
    )
  }
}
