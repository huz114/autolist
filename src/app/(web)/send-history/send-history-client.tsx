'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ========================================
// Types
// ========================================

interface Submission {
  id: string
  formUrl: string
  subject: string | null
  messageBody: string | null
  status: string
  submittedAt: string
  source: string
  companyName: string | null
  domain: string | null
}

interface Stats {
  thisWeek: number
  thisMonth: number
  allTime: number
}

interface ApiResponse {
  submissions: Submission[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
  stats: Stats
}

// ========================================
// Status config
// ========================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  submitted: { label: '送信処理中', bg: 'bg-[rgba(245,158,11,0.1)]', text: 'text-amber-400' },
  confirmed: { label: '送信完了', bg: 'bg-[rgba(6,199,85,0.1)]', text: 'text-[#06C755]' },
  bounced: { label: '失敗', bg: 'bg-[rgba(255,71,87,0.1)]', text: 'text-[#ff4757]' },
  replied: { label: '返信あり', bg: 'bg-[rgba(6,199,85,0.15)]', text: 'text-[#06C755]' },
}

function getStatus(status: string) {
  return STATUS_CONFIG[status] || { label: status, bg: 'bg-[#0d1526]', text: 'text-[#8fa3b8]' }
}

// ========================================
// Component
// ========================================

export default function SendHistoryClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats>({ thisWeek: 0, thisMonth: 0, allTime: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const perPage = 20

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data
  const fetchData = useCallback(async (currentPage: number, companyName: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('per_page', String(perPage))
      if (companyName.trim()) params.set('company_name', companyName.trim())

      const res = await fetch(`/api/send-history?${params.toString()}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data: ApiResponse = await res.json()
      setSubmissions(data.submissions)
      setTotal(data.pagination.total)
      setTotalPages(data.pagination.total_pages)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      setSubmissions([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [perPage])

  useEffect(() => {
    setPage(1)
    fetchData(1, debouncedSearch)
  }, [debouncedSearch, fetchData])

  useEffect(() => {
    fetchData(page, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // ========================================
  // Render
  // ========================================
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">送信履歴</h1>
        <p className="text-sm text-[#8fa3b8]">フォーム営業の送信履歴を確認できます</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
          <p className="text-xs text-[#8fa3b8] mb-1">今週</p>
          <p className="text-2xl font-bold text-[#f0f4f8]">
            {stats.thisWeek}<span className="text-sm text-[#8fa3b8] ml-1">件</span>
          </p>
        </div>
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
          <p className="text-xs text-[#8fa3b8] mb-1">今月</p>
          <p className="text-2xl font-bold text-[#f0f4f8]">
            {stats.thisMonth}<span className="text-sm text-[#8fa3b8] ml-1">件</span>
          </p>
        </div>
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-4">
          <p className="text-xs text-[#8fa3b8] mb-1">累計</p>
          <p className="text-2xl font-bold text-[#06C755]">
            {stats.allTime}<span className="text-sm text-[#8fa3b8] ml-1">件</span>
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="企業名で検索..."
          className="w-full sm:w-72 bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 text-sm text-[#f0f4f8] placeholder-[#4a6080] focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.07)]">
                  <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">送信日時</th>
                  <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">企業名</th>
                  <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">フォームURL</th>
                  <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">ステータス</th>
                  <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">営業文</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.04)]">
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 bg-[#1a2332] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 bg-[#1a2332] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 bg-[#1a2332] rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-16 bg-[#1a2332] rounded-full animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-44 bg-[#1a2332] rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : error ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <p className="text-sm text-[#ff4757] mb-2">データの取得に失敗しました</p>
          <p className="text-xs text-[#4a6080] mb-4">{error}</p>
          <button
            onClick={() => fetchData(page, debouncedSearch)}
            className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-4 py-2 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            再試行
          </button>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <p className="text-[#8fa3b8] mb-2">送信履歴がありません</p>
          <p className="text-sm text-[#4a6080]">
            {debouncedSearch
              ? '検索条件に一致する履歴がありません'
              : 'リストを確定してフォーム送信を行ってください'}
          </p>
          <Link
            href="/my-lists"
            className="inline-block mt-4 text-sm text-[#06C755] hover:text-[#2ad96e] transition-colors"
          >
            ← マイリストを見る
          </Link>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.07)]">
                    <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">送信日時</th>
                    <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">企業名</th>
                    <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">フォームURL</th>
                    <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">ステータス</th>
                    <th className="text-left text-xs text-[#8fa3b8] font-medium px-4 py-3">営業文</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const st = getStatus(s.status)
                    return (
                      <tr key={s.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="px-4 py-3 text-[#8fa3b8] whitespace-nowrap">
                          {new Date(s.submittedAt).toLocaleString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-[#f0f4f8] font-medium max-w-[200px] truncate">
                          {s.companyName || '-'}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate">
                          <a
                            href={s.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#06C755] hover:text-[#04a344] hover:underline transition-colors"
                          >
                            {s.formUrl ? new URL(s.formUrl).hostname : '-'}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8fa3b8] max-w-[250px] truncate" title={s.messageBody || ''}>
                          {s.subject || (s.messageBody ? s.messageBody.slice(0, 40) + '...' : '-')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs text-[#4a6080]">
                {total}件中 {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}件
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-lg text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(6,199,85,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  前へ
                </button>
                <span className="text-sm text-[#8fa3b8]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-lg text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(6,199,85,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  次へ
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
