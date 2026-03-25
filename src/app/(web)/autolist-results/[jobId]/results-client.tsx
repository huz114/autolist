'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type UrlItem = {
  id: string
  url: string
  domain: string
  companyName: string | null
  industry: string | null
  location: string | null
  phoneNumber: string | null
  employeeCount: string | null
  capitalAmount: string | null
  representativeName: string | null
  establishedYear: number | null
  businessDescription: string | null
  formUrl: string | null
  hasForm: boolean
  excluded: boolean
  email?: string | null
  snsLinks?: string | null
  hasRecruitPage?: boolean
  siteUpdatedAt?: string | null
  searchTags?: string[]
  industryMajor?: string | null
  industryMinor?: string | null
  officerPageUrl?: string | null
  officers?: string | null
  relatedSites?: string[]
  latestNews?: string | null
  isAdvertiser?: boolean
}

type FormFilter = 'all' | 'hasForm' | 'noForm'
type PhoneFilter = 'all' | 'hasPhone' | 'noPhone'

type Props = {
  jobId: string
  keyword: string
  industry: string | null
  location: string | null
  urls: UrlItem[]
}

function downloadCsv(urls: UrlItem[], keyword: string) {
  const headers = [
    '企業名', '業種', '所在地', 'URL', '電話番号', 'メールアドレス', '代表者名',
    '設立年', '従業員数', '資本金', '事業内容', 'フォームURL', 'フォームあり',
    '業種大分類', '業種小分類', 'X', 'Instagram', 'Facebook', 'YouTube',
    '採用ページあり', 'サイト更新日', '検索タグ',
    '役員ページURL', '役員一覧', '関連サイト', '最新ニュース', '広告出稿',
  ]

  const escapeField = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const rows = urls.map(u => {
    let sns: Record<string, string> = {}
    try {
      if (u.snsLinks) sns = JSON.parse(u.snsLinks)
    } catch { /* ignore */ }

    let officersStr = ''
    try {
      if (u.officers) {
        const parsed = JSON.parse(u.officers) as { name: string; title: string }[]
        officersStr = parsed.map(o => `${o.title}:${o.name}`).join(' / ')
      }
    } catch { /* ignore */ }

    let latestNewsStr = ''
    try {
      if (u.latestNews) {
        const parsed = JSON.parse(u.latestNews) as { date: string; title: string }[]
        latestNewsStr = parsed.map(n => `${n.date}:${n.title}`).join(' / ')
      }
    } catch { /* ignore */ }

    return [
      u.companyName ?? '',
      u.industry ?? '',
      u.location ?? '',
      u.url,
      u.phoneNumber ?? '',
      u.email ?? '',
      u.representativeName ?? '',
      u.establishedYear != null ? String(u.establishedYear) : '',
      u.employeeCount ?? '',
      u.capitalAmount ?? '',
      u.businessDescription ?? '',
      u.formUrl ?? '',
      u.hasForm ? 'あり' : 'なし',
      u.industryMajor ?? '',
      u.industryMinor ?? '',
      sns.x ?? '',
      sns.instagram ?? '',
      sns.facebook ?? '',
      sns.youtube ?? '',
      u.hasRecruitPage ? 'はい' : 'いいえ',
      u.siteUpdatedAt ?? '',
      (u.searchTags ?? []).join('/'),
      u.officerPageUrl ?? '',
      officersStr,
      (u.relatedSites ?? []).join(' / '),
      latestNewsStr,
      u.isAdvertiser ? 'はい' : 'いいえ',
    ].map(escapeField).join(',')
  })

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  a.href = url
  a.download = `${keyword}_${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ResultsClient({ jobId, keyword, industry, location, urls }: Props) {
  const [formFilter, setFormFilter] = useState<FormFilter>('all')
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>('all')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const toggleExpand = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const filteredUrls = urls.filter(u => {
    if (formFilter === 'hasForm' && !u.hasForm) return false
    if (formFilter === 'noForm' && u.hasForm) return false
    if (phoneFilter === 'hasPhone' && !u.phoneNumber) return false
    if (phoneFilter === 'noPhone' && u.phoneNumber) return false
    return true
  }).sort((a, b) => {
    // 情報充実度スコアで降順ソート（フォーム・電話を優先）
    const score = (u: typeof a) => {
      let s = 0
      if (u.hasForm) s += 100
      if (u.phoneNumber) s += 50
      if (u.representativeName) s += 10
      if (u.email) s += 10
      if (u.employeeCount) s += 5
      if (u.capitalAmount) s += 5
      if (u.establishedYear) s += 5
      if (u.businessDescription) s += 3
      if (u.isAdvertiser) s += 20
      if (u.hasRecruitPage) s += 5
      if (u.snsLinks) s += 2
      if (u.officers) s += 2
      return s
    }
    return score(b) - score(a)
  })

  const hasFormUrls = urls.some(u => u.formUrl)

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link
          href="/my-lists"
          className="inline-flex items-center gap-2 text-sm text-[#06C755] hover:text-[#04a344] font-medium bg-[rgba(6,199,85,0.08)] hover:bg-[rgba(6,199,85,0.15)] border border-[rgba(6,199,85,0.2)] hover:border-[rgba(6,199,85,0.4)] px-4 py-2 rounded-full transition-all mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          マイリストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">企業リスト</h1>
        <p className="text-sm text-[#8fa3b8]">
          収集が完了しました
        </p>
      </div>

      {/* Job情報バナー */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <span className="text-xs text-[#8494a7] block mb-0.5">キーワード</span>
          <span className="text-[#f0f4f8] font-medium">{keyword}</span>
        </div>
        {industry && (
          <div>
            <span className="text-xs text-[#8494a7] block mb-0.5">業種</span>
            <span className="text-[#f0f4f8]">{industry}</span>
          </div>
        )}
        {location && (
          <div>
            <span className="text-xs text-[#8494a7] block mb-0.5">エリア</span>
            <span className="text-[#f0f4f8]">{location}</span>
          </div>
        )}
        <div>
          <span className="text-xs text-[#8494a7] block mb-0.5">収集企業数</span>
          <span className="text-[#06C755] font-medium">{urls.length}件</span>
        </div>
      </div>

      {/* フィルター + アクションボタン */}
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8494a7]">フォーム:</span>
            {([
              { value: 'all' as FormFilter, label: 'すべて' },
              { value: 'hasForm' as FormFilter, label: 'あり' },
              { value: 'noForm' as FormFilter, label: 'なし' },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFormFilter(value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  formFilter === value
                    ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border border-[rgba(6,199,85,0.4)]'
                    : 'bg-[rgba(255,255,255,0.05)] text-[#8494a7] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8494a7]">電話番号:</span>
            {([
              { value: 'all' as PhoneFilter, label: 'すべて' },
              { value: 'hasPhone' as PhoneFilter, label: 'あり' },
              { value: 'noPhone' as PhoneFilter, label: 'なし' },
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPhoneFilter(value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  phoneFilter === value
                    ? 'bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.4)]'
                    : 'bg-[rgba(255,255,255,0.05)] text-[#8494a7] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* アクションボタン群 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCsv(filteredUrls, keyword)}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full transition-all cursor-pointer border border-[rgba(255,255,255,0.15)] text-[#f0f4f8] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.25)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSVダウンロード
          </button>
          {hasFormUrls && (
            <Link
              href={`/send/${jobId}`}
              className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] whitespace-nowrap"
            >
              フォーム送信へ &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* 企業リスト */}
      {urls.length === 0 ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#06C755]">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <p className="text-[#f0f4f8] font-medium mb-2">企業データがありません</p>
          <p className="text-sm text-[#8494a7] mb-6">
            この検索条件ではフォームのある企業が見つかりませんでした。別の業種・地域で再度お試しください。
          </p>
          <Link
            href="/my-lists"
            className="inline-flex items-center gap-1.5 bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] text-[#f0f4f8] text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
          >
            マイリストに戻る
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUrls.map((u, idx) => {
            const isExpanded = expandedCards.has(u.id)
            let snsEntries: [string, string][] = []
            try {
              if (u.snsLinks) {
                const sns = JSON.parse(u.snsLinks) as Record<string, string>
                snsEntries = Object.entries(sns).filter(([, v]) => v) as [string, string][]
              }
            } catch { /* ignore */ }
            const snsLabels: Record<string, string> = { x: 'X', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' }

            let parsedOfficers: { name: string; title: string }[] = []
            try {
              if (u.officers) parsedOfficers = JSON.parse(u.officers) as { name: string; title: string }[]
            } catch { /* ignore */ }

            let parsedNews: { date: string; title: string }[] = []
            try {
              if (u.latestNews) parsedNews = JSON.parse(u.latestNews) as { date: string; title: string }[]
            } catch { /* ignore */ }

            const hasLayer2 = u.establishedYear || u.employeeCount || u.capitalAmount ||
              u.industryMajor || u.industryMinor || u.formUrl || snsEntries.length > 0 ||
              u.siteUpdatedAt || (u.searchTags && u.searchTags.length > 0) ||
              parsedOfficers.length > 0 || (u.relatedSites && u.relatedSites.length > 0) ||
              u.officerPageUrl || parsedNews.length > 0

            return (
              <div
                key={u.id}
                className="bg-[#111827] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(6,199,85,0.4)] rounded-2xl px-5 py-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs tabular-nums mt-0.5 shrink-0 text-[#8494a7]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* Row 1: 企業名 + バッジ */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#f0f4f8] truncate">
                        {u.companyName ?? u.url}
                      </p>
                      {u.hasForm ? (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(6,199,85,0.12)] text-[#06C755] border border-[rgba(6,199,85,0.25)]">
                          フォームあり
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#8494a7] border border-[rgba(255,255,255,0.1)]">
                          フォームなし
                        </span>
                      )}
                      {u.phoneNumber ? (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(59,130,246,0.12)] text-[#3b82f6] border border-[rgba(59,130,246,0.25)]">
                          電話あり
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#8494a7] border border-[rgba(255,255,255,0.1)]">
                          電話なし
                        </span>
                      )}
                      {u.hasRecruitPage && (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(6,199,85,0.12)] text-[#06C755] border border-[rgba(6,199,85,0.25)]">
                          採用中
                        </span>
                      )}
                      {u.isAdvertiser && (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(250,204,21,0.12)] text-[#facc15] border border-[rgba(250,204,21,0.25)]">
                          広告出稿中
                        </span>
                      )}
                    </div>

                    {/* Row 2: 業種 + 所在地 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {u.industry && (
                        <span className="text-xs text-[#8494a7]">{u.industry}</span>
                      )}
                      {u.location && (
                        <span className="text-xs text-[#8494a7]">{u.location}</span>
                      )}
                    </div>

                    {/* Row 3: URL */}
                    <a
                      href={`https://${u.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#06C755] hover:text-[#04a344] transition-colors truncate block mt-0.5"
                    >
                      {`https://${u.domain}`}
                    </a>

                    {/* Row 4: Contact info grid (always visible) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                        <span className="text-[11px] text-[#6b7280] block">電話番号</span>
                        <span className="text-xs text-[#f0f4f8]">{u.phoneNumber ?? '-'}</span>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                        <span className="text-[11px] text-[#6b7280] block">代表者名</span>
                        <span className="text-xs text-[#f0f4f8]">{u.representativeName ?? '-'}</span>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                        <span className="text-[11px] text-[#6b7280] block">メール</span>
                        {u.email ? (
                          <a href={`mailto:${u.email}`} className="text-xs text-[#06C755] hover:text-[#04a344] transition-colors truncate block">
                            {u.email}
                          </a>
                        ) : (
                          <span className="text-xs text-[#f0f4f8]">-</span>
                        )}
                      </div>
                    </div>

                    {/* Row 5: Business description + toggle */}
                    <div className="flex items-end justify-between gap-4 mt-2">
                      <div className="min-w-0 flex-1">
                        {u.businessDescription && (
                          <p className="text-xs text-[#8494a7] line-clamp-1">
                            <span className="text-[#6b7280]">事業内容: </span>
                            {u.businessDescription}
                          </p>
                        )}
                      </div>
                      {hasLayer2 && (
                        <button
                          onClick={() => toggleExpand(u.id)}
                          className="shrink-0 text-xs text-[#8494a7] hover:text-[#c8d6e5] cursor-pointer transition-colors"
                        >
                          {isExpanded ? '閉じる \u25B2' : '詳細を見る \u25BC'}
                        </button>
                      )}
                    </div>

                    {/* Layer 2: Expandable details */}
                    {isExpanded && hasLayer2 && (
                      <div className="mt-3">
                        {/* 基本情報 */}
                        <div className="border-t border-[rgba(255,255,255,0.05)] pt-3">
                          <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1.5">基本情報</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                              <span className="text-[11px] text-[#6b7280] block">設立</span>
                              <span className="text-xs text-[#f0f4f8]">{u.establishedYear ? `${u.establishedYear}年` : '-'}</span>
                            </div>
                            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                              <span className="text-[11px] text-[#6b7280] block">従業員数</span>
                              <span className="text-xs text-[#f0f4f8]">{u.employeeCount ?? '-'}</span>
                            </div>
                            <div className="bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                              <span className="text-[11px] text-[#6b7280] block">資本金</span>
                              <span className="text-xs text-[#f0f4f8]">{u.capitalAmount ?? '-'}</span>
                            </div>
                          </div>
                        </div>

                        {/* 業種・営業情報 */}
                        {(u.industryMajor || u.industryMinor || u.formUrl || snsEntries.length > 0 || u.siteUpdatedAt) && (
                          <div className="border-t border-[rgba(255,255,255,0.05)] mt-3 pt-3">
                            <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1.5">業種・営業情報</p>
                            <div className="space-y-1.5">
                              {(u.industryMajor || u.industryMinor) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">業種分類:</span>
                                  <span className="text-xs text-[#c8d6e5]">
                                    {u.industryMajor}{u.industryMajor && u.industryMinor ? ' > ' : ''}{u.industryMinor ?? ''}
                                  </span>
                                </div>
                              )}
                              {u.formUrl && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">フォームURL:</span>
                                  <a
                                    href={u.formUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[#06C755] hover:text-[#04a344] transition-colors truncate"
                                  >
                                    {u.formUrl}
                                  </a>
                                </div>
                              )}
                              {snsEntries.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">SNS:</span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {snsEntries.map(([key, snsUrl]) => (
                                      <a
                                        key={key}
                                        href={snsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-[#8494a7] border border-[rgba(255,255,255,0.1)] hover:text-[#c8d6e5] hover:border-[rgba(255,255,255,0.2)] transition-colors"
                                      >
                                        {snsLabels[key] ?? key}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {u.siteUpdatedAt && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">更新日:</span>
                                  <span className="text-xs text-[#c8d6e5]">{u.siteUpdatedAt}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 検索タグ */}
                        {u.searchTags && u.searchTags.length > 0 && (
                          <div className="border-t border-[rgba(255,255,255,0.05)] mt-3 pt-3">
                            <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1.5">検索タグ</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.searchTags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e293b] text-[#8494a7]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 役員 */}
                        {parsedOfficers.length > 0 && (
                          <div className="border-t border-[rgba(255,255,255,0.05)] mt-3 pt-3">
                            <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1.5">役員</p>
                            <p className="text-xs text-[#c8d6e5]">
                              {parsedOfficers.map(o => `${o.title} ${o.name}`).join(' / ')}
                            </p>
                          </div>
                        )}

                        {/* 関連情報 */}
                        {((u.relatedSites && u.relatedSites.length > 0) || u.officerPageUrl || parsedNews.length > 0) && (
                          <div className="border-t border-[rgba(255,255,255,0.05)] mt-3 pt-3">
                            <p className="text-[10px] uppercase tracking-wider text-[#6b7280] mb-1.5">関連情報</p>
                            <div className="space-y-1.5">
                              {u.relatedSites && u.relatedSites.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">関連サイト:</span>
                                  {u.relatedSites.map((site, i) => (
                                    <a key={i} href={`https://${site}`} target="_blank" rel="noopener noreferrer"
                                       className="text-xs text-[#60a5fa] hover:underline">
                                      {site}
                                    </a>
                                  ))}
                                </div>
                              )}
                              {u.officerPageUrl && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#6b7280] shrink-0">役員ページ:</span>
                                  <a href={u.officerPageUrl} target="_blank" rel="noopener noreferrer"
                                     className="text-xs text-[#60a5fa] hover:underline truncate">
                                    {u.officerPageUrl}
                                  </a>
                                </div>
                              )}
                              {parsedNews.length > 0 && (
                                <div>
                                  <span className="text-[11px] text-[#6b7280]">最新ニュース:</span>
                                  <div className="space-y-0.5 mt-0.5">
                                    {parsedNews.slice(0, 3).map((n, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="text-[#6b7280] mr-2">{n.date}</span>
                                        <span className="text-[#c9d1d9]">{n.title}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 下部アクションボタン（リストが長い場合） */}
      {urls.length > 5 && (
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={() => downloadCsv(filteredUrls, keyword)}
            className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full transition-all cursor-pointer border border-[rgba(255,255,255,0.15)] text-[#f0f4f8] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.25)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSVダウンロード
          </button>
          {hasFormUrls && (
            <Link
              href={`/send/${jobId}`}
              className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] whitespace-nowrap"
            >
              フォーム送信へ &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
