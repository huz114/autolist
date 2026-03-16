import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 })
  }

  // トークンを検索
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!resetToken) {
    return NextResponse.json({ error: 'このリンクは無効です' }, { status: 400 })
  }

  if (resetToken.expiresAt < new Date()) {
    // 期限切れトークンを削除
    await prisma.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: 'このリンクは期限切れです。再度パスワードリセットをお試しください。' }, { status: 400 })
  }

  // パスワードをハッシュ化してユーザーを更新
  const hashed = await bcrypt.hash(password, 12)

  await prismaShiryolog.user.update({
    where: { email: resetToken.email },
    data: { password: hashed },
  })

  // 使用済みトークンを削除
  await prisma.passwordResetToken.delete({ where: { token } })

  return NextResponse.json({ message: 'パスワードを変更しました' })
}
