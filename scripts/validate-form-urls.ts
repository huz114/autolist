/**
 * formUrl一括検証スクリプト
 * - 全formUrlにHEADリクエストを送信
 * - SSL無効/接続不可/リダイレクト先がトップページの場合はhasForm=falseに更新
 *
 * 使い方: npx tsx scripts/validate-form-urls.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

const isDryRun = process.argv.includes('--dry-run')
const CONCURRENCY = 10
const TIMEOUT_MS = 10000

interface ValidationResult {
  id: string
  domain: string
  formUrl: string
  status: 'ok' | 'ssl_error' | 'connection_error' | 'timeout' | 'redirect_to_top' | 'http_error'
  detail: string
}

async function validateUrl(id: string, domain: string, formUrl: string): Promise<ValidationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(formUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutolistBot/1.0)',
      },
    })

    clearTimeout(timeout)

    // リダイレクト先がトップページかチェック
    const finalUrl = res.url || formUrl
    const formUrlObj = new URL(formUrl)
    const finalUrlObj = new URL(finalUrl)

    // formUrlにパス（/contact等）があるのにリダイレクト先がルートの場合
    const formPath = formUrlObj.pathname.replace(/\/+$/, '')
    const finalPath = finalUrlObj.pathname.replace(/\/+$/, '')
    if (formPath && formPath !== '/' && (!finalPath || finalPath === '/') && formUrlObj.hostname !== finalUrlObj.hostname) {
      return { id, domain, formUrl, status: 'redirect_to_top', detail: `Redirected to ${finalUrl}` }
    }

    if (!res.ok && res.status >= 400) {
      return { id, domain, formUrl, status: 'http_error', detail: `HTTP ${res.status}` }
    }

    return { id, domain, formUrl, status: 'ok', detail: `HTTP ${res.status}` }
  } catch (err: any) {
    clearTimeout(timeout)
    const msg = err?.message || String(err)

    if (msg.includes('abort') || msg.includes('timeout')) {
      return { id, domain, formUrl, status: 'timeout', detail: msg }
    }
    if (msg.includes('SSL') || msg.includes('certificate') || msg.includes('CERT') || msg.includes('ERR_TLS')) {
      return { id, domain, formUrl, status: 'ssl_error', detail: msg }
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('ECONNRESET') || msg.includes('fetch failed')) {
      return { id, domain, formUrl, status: 'connection_error', detail: msg }
    }

    return { id, domain, formUrl, status: 'connection_error', detail: msg }
  }
}

async function processInBatches<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (i + concurrency < items.length) {
      process.stdout.write(`  ${i + concurrency}/${items.length} checked...\r`)
    }
  }
  return results
}

async function main() {
  console.log(`formUrl一括検証 ${isDryRun ? '(DRY RUN)' : ''}`)
  console.log('---')

  // hasForm=true かつ formUrlが存在する企業を取得
  const companies = await prisma.collectedUrl.findMany({
    where: {
      hasForm: true,
      formUrl: { not: null },
      excluded: false,
    },
    select: {
      id: true,
      domain: true,
      formUrl: true,
      companyName: true,
    },
  })

  console.log(`対象: ${companies.length}件`)

  const results = await processInBatches(
    companies,
    (c) => validateUrl(c.id, c.domain, c.formUrl!),
    CONCURRENCY
  )

  // 集計
  const stats = { ok: 0, ssl_error: 0, connection_error: 0, timeout: 0, redirect_to_top: 0, http_error: 0 }
  const failures: ValidationResult[] = []

  for (const r of results) {
    stats[r.status]++
    if (r.status !== 'ok') {
      failures.push(r)
    }
  }

  console.log('\n--- 結果 ---')
  console.log(`OK: ${stats.ok}`)
  console.log(`SSL エラー: ${stats.ssl_error}`)
  console.log(`接続エラー: ${stats.connection_error}`)
  console.log(`タイムアウト: ${stats.timeout}`)
  console.log(`トップページリダイレクト: ${stats.redirect_to_top}`)
  console.log(`HTTPエラー: ${stats.http_error}`)

  if (failures.length > 0) {
    console.log('\n--- 問題あり一覧 ---')
    for (const f of failures) {
      const company = companies.find(c => c.id === f.id)
      console.log(`  [${f.status}] ${company?.companyName || f.domain} | ${f.formUrl} | ${f.detail}`)
    }
  }

  // hasForm=false に更新
  const idsToDisable = failures
    .filter(f => f.status === 'ssl_error' || f.status === 'connection_error')
    .map(f => f.id)

  if (idsToDisable.length > 0) {
    if (isDryRun) {
      console.log(`\n[DRY RUN] ${idsToDisable.length}件のhasFormをfalseに更新予定`)
    } else {
      const updated = await prisma.collectedUrl.updateMany({
        where: { id: { in: idsToDisable } },
        data: { hasForm: false },
      })
      console.log(`\n${updated.count}件のhasFormをfalseに更新しました`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
