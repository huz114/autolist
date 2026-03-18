import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 })
  }

  // ユーザーが存在するか確認（存在しない場合も同じレスポンスを返す）
  const user = await prismaShiryolog.user.findUnique({ where: { email } })

  if (user) {
    // 既存のトークンを削除
    await prismaShiryolog.passwordResetToken.deleteMany({ where: { email } })

    // 新しいトークン生成
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1時間後

    await prismaShiryolog.passwordResetToken.create({
      data: { email, token, expiresAt },
    })

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://autolist-production.up.railway.app'}/reset-password?token=${token}`

    await resend.emails.send({
      from: 'noreply@shiryolog.com',
      to: email,
      subject: '【オートリスト】パスワードリセット',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #333;">
          <h2 style="color: #06C755;">オートリスト パスワードリセット</h2>
          <p>パスワードリセットのリクエストを受け付けました。</p>
          <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}"
               style="background: #06C755; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              パスワードをリセットする
            </a>
          </p>
          <p style="color: #888; font-size: 13px;">
            このリンクは1時間有効です。<br>
            心当たりのない場合は、このメールを無視してください。
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">オートリスト</p>
        </div>
      `,
    })
  }

  // セキュリティ上、ユーザーの存在有無に関わらず同じレスポンスを返す
  return NextResponse.json({ message: 'メールを送信しました' })
}
