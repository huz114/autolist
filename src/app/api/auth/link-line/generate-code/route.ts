import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const userId = session.user.id

    // 既存の未使用コードを削除
    await prisma.lineLinkCode.deleteMany({
      where: {
        userId,
        usedAt: null,
      },
    })

    // 6桁ランダム数字コード生成
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')

    // 有効期限5分
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.lineLinkCode.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    })

    return NextResponse.json({ code, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    console.error('[generate-code] Error:', error)
    return NextResponse.json(
      { error: 'コード生成に失敗しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
