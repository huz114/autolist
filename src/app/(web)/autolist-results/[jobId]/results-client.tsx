'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type UrlItem = {
  id: string
  url: string
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
    '企業名', '業種', '所在地', 'URL', '電話番号', '代表者名',
    '設立年', '従業員数', '資本金', '事業内容', 'フォームURL', 'フォームあり',
  ]

  const escapeField = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const rows = urls.map(u => [
    u.companyName ?? '',
    u.industry ?? '',
    u.location ?? '',
    u.url,
    u.phoneNumber ?? '',
    u.representativeName ?? '',
    u.establishedYear != null ? String(u.establishedYear) : '',
    u.employeeCount ?? '',
    u.capitalAmount ?? '',
    u.businessDescription ?? '',
    u.formUrl ?? '',
    u.hasForm ? 'あり' : 'なし',
  ].map(escapeField).join(','))

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

  const filteredUrls = urls.filter(u => {
    if (formFilter === 'hasForm' && !u.hasForm) return false
    if (formFilter === 'noForm' && u.hasForm) return false
    if (phoneFilter === 'hasPhone' && !u.phoneNumber) return false
    if (phoneFilter === 'noPhone' && u.phoneNumber) return false
    return true
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
          {filteredUrls.map((u, idx) => (
            <div
              key={u.id}
              className="bg-[#111827] border border-[rgba(255,255,255,0.07)] hover:border-[rgba(6,199,85,0.4)] rounded-2xl px-5 py-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-xs tabular-nums mt-0.5 shrink-0 text-[#8494a7]">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  {/* 企業名 + バッジ行 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[#f0f4f8] truncate">
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
                  </div>

                  {/* 業種・所在地 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {u.industry && (
                      <span className="text-xs text-[#8494a7]">{u.industry}</span>
                    )}
                    {u.location && (
                      <span className="text-xs text-[#8494a7]">{u.location}</span>
                    )}
                  </div>

                  {/* URL */}
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#06C755] hover:text-[#04a344] transition-colors truncate block mt-0.5"
                  >
                    {u.url}
                  </a>

                  {/* 詳細情報 */}
                  {(u.representativeName || u.establishedYear || u.employeeCount || u.capitalAmount || u.businessDescription || u.phoneNumber || u.formUrl) && (
                    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        {u.phoneNumber && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8494a7] shrink-0">電話番号:</span>
                            <span className="text-xs text-[#c8d6e5]">{u.phoneNumber}</span>
                          </div>
                        )}
                        {u.representativeName && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8494a7] shrink-0">代表者名:</span>
                            <span className="text-xs text-[#c8d6e5]">{u.representativeName}</span>
                          </div>
                        )}
                        {u.establishedYear && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8494a7] shrink-0">設立:</span>
                            <span className="text-xs text-[#c8d6e5]">{u.establishedYear}年設立</span>
                          </div>
                        )}
                        {u.employeeCount && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8494a7] shrink-0">従業員数:</span>
                            <span className="text-xs text-[#c8d6e5]">{u.employeeCount}</span>
                          </div>
                        )}
                        {u.capitalAmount && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#8494a7] shrink-0">資本金:</span>
                            <span className="text-xs text-[#c8d6e5]">{u.capitalAmount}</span>
                          </div>
                        )}
                        {u.formUrl && (
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <span className="text-xs text-[#8494a7] shrink-0">フォームURL:</span>
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
                      </div>
                      {u.businessDescription && (
                        <div className="mt-1.5">
                          <span className="text-xs text-[#8494a7]">事業内容: </span>
                          <span className="text-xs text-[#c8d6e5] line-clamp-2">{u.businessDescription}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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
