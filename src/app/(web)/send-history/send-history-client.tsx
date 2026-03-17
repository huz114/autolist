'use client'

import { useState, useEffect, useCallback } from 'react'

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
  submitted: { label: '送信済み', bg: 'bg-emerald-900/30', text: 'text-emerald-400' },
  confirmed: { label: '確認済み', bg: 'bg-blue-900/30', text: 'text-blue-400' },
  bounced: { label: '失敗', bg: 'bg-red-900/30', text: 'text-red-400' },
  replied: { label: '返信あり', bg: 'bg-orange-900/30', text: 'text-orange-400' },
}

function getStatus(status: string) {
  return STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-800', text: 'text-gray-400' }
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
        <h1 className="text-2xl font-bold text-white mb-1">送信履歴</h1>
        <p className="text-sm text-gray-400">フォーム営業の送信履歴を確認できます</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">今週</p>
          <p className="text-2xl font-bold text-white">
            {stats.thisWeek}<span className="text-sm text-gray-400 ml-1">件</span>
          </p>
        </div>
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">今月</p>
          <p className="text-2xl font-bold text-white">
            {stats.thisMonth}<span className="text-sm text-gray-400 ml-1">件</span>
          </p>
        </div>
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">累計</p>
          <p className="text-2xl font-bold text-orange-400">
            {stats.allTime}<span className="text-sm text-gray-400 ml-1">件</span>
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
          className="w-full sm:w-72 bg-[#16161f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400/50 transition-colors"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">読み込み中...</p>
        </div>
      ) : error ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-sm text-red-400 mb-2">データの取得に失敗しました</p>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => fetchData(page, debouncedSearch)}
            className="bg-orange-500 hover:bg-orange-400 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            再試行
          </button>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-2">送信履歴がありません</p>
          <p className="text-sm text-gray-500">
            {debouncedSearch
              ? '検索条件に一致する履歴がありません'
              : 'リストを確定してフォーム送信を行ってください'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#16161f] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">送信日時</th>
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">企業名</th>
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">フォームURL</th>
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">ステータス</th>
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">営業文</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const st = getStatus(s.status)
                    return (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                          {new Date(s.submittedAt).toLocaleString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                          {s.companyName || '-'}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate">
                          <a
                            href={s.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-400 hover:text-orange-300 hover:underline transition-colors"
                          >
                            {s.formUrl ? new URL(s.formUrl).hostname : '-'}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-[250px] truncate" title={s.messageBody || ''}>
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
              <p className="text-xs text-gray-500">
                {total}件中 {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)}件
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm bg-[#16161f] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-orange-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  前へ
                </button>
                <span className="text-sm text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm bg-[#16161f] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-orange-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
