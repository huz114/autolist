import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    companyIds: string[]
    subject: string
    body: string
    senderInfo: {
      name: string
      furigana: string
      email: string
      phone: string
      companyName: string
      address?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { companyIds, subject, body: messageBody, senderInfo } = body

  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return NextResponse.json({ error: '送信先企業IDは必須です' }, { status: 400 })
  }

  if (!subject?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: '件名と本文は必須です' }, { status: 400 })
  }

  if (!senderInfo?.name?.trim() || !senderInfo?.companyName?.trim()) {
    return NextResponse.json({ error: '送信者情報（会社名・担当者名）は必須です' }, { status: 400 })
  }

  // companyIds から CollectedUrl を取得（hasForm=true, formUrl存在、ユーザー所有チェック）
  const companies = await prisma.collectedUrl.findMany({
    where: {
      id: { in: companyIds },
      hasForm: true,
      formUrl: { not: null },
      excluded: false,
      job: {
        userId: session.user.id,
      },
    },
    include: {
      job: { select: { id: true } },
    },
  })

  if (companies.length === 0) {
    return NextResponse.json(
      { error: '送信可能な企業が見つかりません' },
      { status: 400 }
    )
  }

  // 30日クールダウンチェック（SendRecordと突合）
  const cooldownDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const recentSendRecords = await prisma.sendRecord.findMany({
    where: {
      userId: session.user.id,
      sentAt: { gte: cooldownDate },
      formUrl: {
        in: companies
          .map((c) => c.formUrl)
          .filter((url): url is string => Boolean(url)),
      },
    },
    select: { formUrl: true },
  })

  const recentlySentFormUrls = new Set(
    recentSendRecords.map((r) => r.formUrl).filter(Boolean)
  )

  // クールダウン企業を除外
  const sendableCompanies = companies.filter(
    (c) => c.formUrl && !recentlySentFormUrls.has(c.formUrl)
  )
  const skippedCount = companies.length - sendableCompanies.length

  if (sendableCompanies.length === 0) {
    return NextResponse.json(
      { error: '全ての企業がクールダウン期間中です（送信後30日以内）', skippedCount },
      { status: 400 }
    )
  }

  // formUrlの事前検証（GETでHTMLを取得し、<form>要素の有無を確認）
  // HEADだけではサーバーが応答してもページが空のケースを検出できないため
  console.log(`[bulk-initiate] Starting URL validation for ${sendableCompanies.length} companies...`);
  const urlValidationResults = await Promise.allSettled(
    sendableCompanies.map(async (company) => {
      if (!company.formUrl) return { company, valid: false, reason: 'no_url' }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch(company.formUrl, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
        })
        clearTimeout(timeout)
        if (!res.ok && res.status >= 400) {
          return { company, valid: false, reason: `http_${res.status}` }
        }
        // HTMLを取得して<form>タグの有無をチェック
        const contentType = res.headers.get('content-type') || ''
        if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
          return { company, valid: false, reason: 'not_html' }
        }
        const html = await res.text()
        // ページが実質空（100文字未満）またはフォームなし
        if (html.length < 100) {
          return { company, valid: false, reason: 'empty_page' }
        }
        if (!html.includes('<form') && !html.includes('<FORM')) {
          return { company, valid: false, reason: 'no_form_element' }
        }
        return { company, valid: true, reason: 'ok' }
      } catch (err: any) {
        clearTimeout(timeout)
        return { company, valid: false, reason: err?.message?.includes('abort') ? 'timeout' : 'connection_error' }
      }
    })
  )

  const validCompanies = urlValidationResults
    .filter((r): r is PromiseFulfilledResult<{ company: typeof sendableCompanies[0]; valid: boolean; reason: string }> =>
      r.status === 'fulfilled' && r.value.valid
    )
    .map(r => r.value.company)

  const invalidCount = sendableCompanies.length - validCompanies.length
  console.log(`[bulk-initiate] Validation complete: ${validCompanies.length} valid, ${invalidCount} invalid`);
  urlValidationResults.forEach(r => {
    if (r.status === 'fulfilled' && !r.value.valid) {
      console.log(`[bulk-initiate] INVALID: ${r.value.company.domain} - ${r.value.reason}`);
    }
  });

  // 接続不可・タイムアウトの企業はhasForm=falseに更新（次回以降除外される）
  const invalidIds = urlValidationResults
    .filter((r): r is PromiseFulfilledResult<{ company: typeof sendableCompanies[0]; valid: boolean; reason: string }> =>
      r.status === 'fulfilled' && !r.value.valid &&
      (r.value.reason === 'connection_error' || r.value.reason === 'timeout')
    )
    .map(r => r.value.company.id)

  if (invalidIds.length > 0) {
    await prisma.collectedUrl.updateMany({
      where: { id: { in: invalidIds } },
      data: { hasForm: false },
    })
  }

  if (validCompanies.length === 0) {
    return NextResponse.json(
      { error: '全ての企業のフォームURLに接続できませんでした', skippedCount, invalidCount },
      { status: 400 }
    )
  }

  // fillEntries を構築
  const fillEntries = validCompanies.map((company) => ({
    companyId: company.id,
    companyName: company.companyName || '',
    companyDomain: company.domain,
    formUrl: company.formUrl,
    salesCopy: { subject, body: messageBody },
    senderInfo: {
      name: senderInfo.name,
      email: senderInfo.email,
      phone: senderInfo.phone,
      furigana: senderInfo.furigana || '',
      companyName: senderInfo.companyName,
      address: senderInfo.address || '',
    },
    timestamp: Date.now(),
  }))

  // ユニークなフォームURL
  const urls = fillEntries
    .map((e) => e.formUrl)
    .filter((url): url is string => Boolean(url))

  // SendRecordは送信完了時にクライアント側で個別作成する（bulk-send-client.tsx）
  // 開始時に一括作成すると、未送信の企業も「フォーム送信済み」と表示されてしまうため

  return NextResponse.json({
    fillEntries,
    urls,
    skippedCount,
    invalidCount,
    sentCount: validCompanies.length,
  })
}
