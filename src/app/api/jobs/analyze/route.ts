import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { analyzeQuery, checkAmbiguousLocation } from '@/lib/analyze-query'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { text } = body
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'テキストを入力してください' }, { status: 400 })
  }

  try {
    const analyzed = await analyzeQuery(text.trim())

    // 曖昧な地域名チェック
    const ambiguousLocation = analyzed.location
      ? checkAmbiguousLocation(analyzed.location)
      : null

    return NextResponse.json({
      industry: analyzed.industry,
      location: analyzed.location,
      targetCount: analyzed.targetCount,
      industryKeywords: analyzed.industryKeywords,
      searchQueries: analyzed.searchQueries,
      excludeTerms: analyzed.excludeTerms,
      isDomestic: analyzed.isDomestic,
      industrySpecified: analyzed.industrySpecified,
      locationSpecified: analyzed.locationSpecified,
      countSpecified: analyzed.countSpecified,
      ambiguousLocation,
    })
  } catch (error) {
    console.error('Analyze query error:', error)
    return NextResponse.json(
      { error: 'クエリの解析に失敗しました。もう少し具体的に入力してください。' },
      { status: 500 }
    )
  }
}
