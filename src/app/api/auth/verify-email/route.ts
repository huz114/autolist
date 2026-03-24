import { NextRequest, NextResponse } from 'next/server'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/verify?status=invalid', req.url)
      )
    }

    // トークン検索
    const verificationToken = await prismaShiryolog.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(
        new URL('/verify?status=invalid', req.url)
      )
    }

    // 有効期限チェック
    if (verificationToken.expires < new Date()) {
      // 期限切れトークンを削除
      await prismaShiryolog.verificationToken.delete({
        where: { id: verificationToken.id },
      })
      return NextResponse.redirect(
        new URL(
          `/verify?status=expired&email=${encodeURIComponent(verificationToken.email)}`,
          req.url
        )
      )
    }

    // ユーザーの emailVerified を更新
    await prismaShiryolog.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: new Date() },
    })

    // 使用済みトークンを削除
    await prismaShiryolog.verificationToken.delete({
      where: { id: verificationToken.id },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url
    return NextResponse.redirect(
      new URL('/verify?status=success', baseUrl)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url
    return NextResponse.redirect(
      new URL('/verify?status=error', baseUrl)
    )
  }
}
