import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(req: NextRequest) {
  const { url } = await req.json()

  if (!url) {
    return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 })
  }

  // URLのバリデーション
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  let html: string
  try {
    const res = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutolistBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return NextResponse.json({ error: `URLへのアクセスに失敗しました (${res.status})` }, { status: 400 })
    }
    html = await res.text()
  } catch (err) {
    clearTimeout(timeout)
    return NextResponse.json(
      { error: err instanceof Error && err.name === 'AbortError' ? 'タイムアウトしました' : 'URLへのアクセスに失敗しました' },
      { status: 400 }
    )
  }

  const $ = cheerio.load(html)

  // 不要なタグを除去
  $('script, style, noscript, nav, footer, header, aside, iframe').remove()

  // メタ情報取得
  const title = $('title').text().trim()
  const description = $('meta[name="description"]').attr('content') || ''
  const ogDescription = $('meta[property="og:description"]').attr('content') || ''

  // 本文テキスト抽出（メインコンテンツを優先）
  const mainContent = $('main, article, .content, #content, .main, #main').first().text()
  const bodyText = mainContent || $('body').text()

  // テキストをクリーンアップ
  const cleanText = bodyText
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000)

  const text = [
    title && `【会社名・サービス名】${title}`,
    (description || ogDescription) && `【概要】${description || ogDescription}`,
    cleanText && `【Webサイト本文】\n${cleanText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return NextResponse.json({ text })
}
