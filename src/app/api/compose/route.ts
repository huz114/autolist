import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logGeminiUsage } from '@/lib/gemini-usage-logger'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { jobId, companyInfo } = await req.json()

    if (!jobId || !companyInfo) {
      return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `以下の会社情報をもとに、営業フォーム送信用のメール文を3パターン作成してください。

会社情報:
${companyInfo}

要件:
- 件名（subject）と本文（body）のセット
- パターンA: 短め（本文100文字以内）、インパクト重視
- パターンB: 標準（200文字程度）、実績・数字を訴求
- パターンC: 丁寧（300文字程度）、相手の課題解決に焦点

必ずJSON配列のみを返してください。それ以外のテキストは一切含めないでください:
[
  { "type": "A", "title": "短め・インパクト型", "subject": "...", "body": "..." },
  { "type": "B", "title": "標準・実績訴求型", "subject": "...", "body": "..." },
  { "type": "C", "title": "丁寧・課題解決型", "subject": "...", "body": "..." }
]`

    const result = await model.generateContent(prompt)
    await logGeminiUsage('compose', result.response.usageMetadata)
    const text = result.response.text()

    // JSONを抽出（コードブロック対応）
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI出力の解析に失敗しました' }, { status: 500 })
    }

    const patterns = JSON.parse(jsonMatch[0])

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('[compose] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
