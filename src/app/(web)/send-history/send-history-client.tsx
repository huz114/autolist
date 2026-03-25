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
  submitted:  { label: '処理中',   bg: 'bg-amber-900/30',              text: 'text-amber-400' },
  pending:    { label: '処理中',   bg: 'bg-amber-900/30',              text: 'text-amber-400' },
  confirmed:  { label: '送信完了', bg: 'bg-[rgba(6,199,85,0.1)]',      text: 'text-[#06C755]' },
  completed:  { label: '完了',     bg: 'bg-[rgba(6,199,85,0.1)]',      text: 'text-[#06C755]' },
  bounced:    { label: 'エラー',   bg: 'bg-[rgba(255,71,87,0.1)]',     text: 'text-[#ff4757]' },
  failed:     { label: 'エラー',   bg: 'bg-[rgba(255,71,87,0.1)]',     text: 'text-[#ff4757]' },
  replied:    { label: '返信あり', bg: 'bg-[rgba(6,199,85,0.15)]',     text: 'text-[#06C755]' },
  cancelled:  { label: 'キャンセル', bg: 'bg-[#0d1526]',              text: 'text-[#8fa3b8]' },
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
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        const message = errorData?.error || (res.status === 401 ? 'ログインが必要です。再度ログインしてください。' : res.status >= 500 ? 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。' : `データの取得に失敗しました (${res.status})`)
        throw new Error(message)
      }

      const data: ApiResponse = await res.json()
      setSubmissions(data.submissions)
      setTotal(data.pagination.total)
      setTotalPages(data.pagination.total_pages)
      setStats(data.stats)
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError(err instanceof Error ? err.message : 'データの取得に失敗しました')
      }
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
        <p className="text-sm text-[#8fa3b8]">フォーム送信の履歴を確認できます</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
          className="w-full sm:w-72 bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 text-sm text-[#f0f4f8] placeholder-[#8494a7] focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl overflow-hidden" role="status" aria-label="読み込み中">
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
          <p className="text-xs text-[#8494a7] mb-4">{error}</p>
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
          <p className="text-sm text-[#8494a7]">
            {debouncedSearch
              ? '検索条件に一致する履歴がありません'
              : 'リストを作成してフォーム送信を行ってください'}
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <Link
              href="/my-lists"
              className="text-sm text-[#06C755] hover:underline transition-colors"
            >
              新しいリストを作成する
            </Link>
            <Link
              href="/my-lists"
              className="text-sm text-[#06C755] hover:underline transition-colors"
            >
              マイリストを見る
            </Link>
          </div>
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
                            {s.formUrl ? (() => { try { return new URL(s.formUrl).hostname } catch { return s.formUrl } })() : '-'}
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
            <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl px-5 py-4 mt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#8fa3b8]">
                  <span className="text-[#f0f4f8] font-medium">{total}</span>件中{' '}
                  <span className="text-[#f0f4f8] font-medium">{(page - 1) * perPage + 1}</span>-
                  <span className="text-[#f0f4f8] font-medium">{Math.min(page * perPage, total)}</span>件を表示
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-full text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(6,199,85,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    前へ
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#06C755]">{page}</span>
                    <span className="text-sm text-[#8494a7]">/</span>
                    <span className="text-sm text-[#8fa3b8]">{totalPages}</span>
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-full text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(6,199,85,0.4)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    次へ
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Next Actions */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-[#f0f4f8] mb-4">次のアクション</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
                <p className="text-[#f0f4f8] font-semibold text-sm mb-1">新しいリストを作成</p>
                <p className="text-[#8fa3b8] text-xs mb-3">別の業種・地域でアプローチを広げましょう</p>
                <Link href="/my-lists" className="text-[#06C755] text-sm hover:underline transition-colors">
                  リストを作成する →
                </Link>
              </div>
              <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
                <p className="text-[#f0f4f8] font-semibold text-sm mb-1">マイリストを確認</p>
                <p className="text-[#8fa3b8] text-xs mb-3">既存リストの詳細確認・CSVダウンロードはこちら</p>
                <Link href="/my-lists" className="text-[#06C755] text-sm hover:underline transition-colors">
                  マイリストへ →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
