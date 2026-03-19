'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface SearchQuery {
  query: string
  resultCount: number
}

interface Job {
  id: string
  keyword: string
  industry: string | null
  location: string | null
  targetCount: number
  status: string
  totalFound: number
  searchQueries: string | null
  createdAt: string
  user: {
    displayName: string | null
    lineUserId: string
  }
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: '待機中', cls: 'text-gray-400 bg-gray-800' },
  running:   { label: '収集中', cls: 'text-blue-400 bg-blue-900/40' },
  completed: { label: '完了',   cls: 'text-green-400 bg-green-900/40' },
  cancelled: { label: 'キャンセル', cls: 'text-red-400 bg-red-900/40' },
  failed:    { label: '失敗',   cls: 'text-red-400 bg-red-900/40' },
}

function formatJst(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'text-gray-400 bg-gray-800' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function parseSearchQueries(raw: string | null): SearchQuery[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const queries = parseSearchQueries(job.searchQueries)
  const totalResults = queries.reduce((sum, q) => sum + q.resultCount, 0)

  return (
    <>
      <tr className="border-b border-white/10 hover:bg-white/[0.03] transition-colors">
        <td className="py-3 px-4 text-sm text-gray-300 whitespace-nowrap">
          {job.id.slice(0, 8)}...
        </td>
        <td className="py-3 pr-4 text-sm text-gray-200 max-w-[120px] truncate">
          {job.user.displayName ?? job.user.lineUserId}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-300 max-w-[140px] truncate" title={job.keyword}>
          {job.keyword}
        </td>
        <td className="py-3 pr-4">
          <div className="flex flex-wrap gap-1">
            {job.industry && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">
                {job.industry}
              </span>
            )}
            {job.location && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-300">
                {job.location}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 text-sm text-gray-200 text-right whitespace-nowrap">
          {job.targetCount.toLocaleString()}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-200 text-right whitespace-nowrap">
          {job.totalFound.toLocaleString()}
        </td>
        <td className="py-3 pr-4">
          <StatusBadge status={job.status} />
        </td>
        <td className="py-3 pr-4 text-sm text-gray-300 whitespace-nowrap">
          {formatJst(job.createdAt)}
        </td>
        <td className="py-3 pr-4 text-sm text-gray-400 text-right whitespace-nowrap">
          {queries.length > 0 ? `${queries.length}件 (${totalResults})` : '-'}
        </td>
        <td className="py-3">
          {queries.length > 0 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-2.5 py-1 rounded transition-colors whitespace-nowrap"
            >
              {expanded ? '▲ 閉じる' : '▼ クエリ'}
            </button>
          ) : (
            <span className="text-xs text-gray-600">-</span>
          )}
        </td>
      </tr>
      {expanded && queries.length > 0 && (
        <tr className="border-b border-white/10">
          <td colSpan={10} className="bg-[#0e0e18] px-6 py-4">
            <p className="text-xs text-gray-400 mb-3">検索クエリ ({queries.length}件)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-2 pr-3 font-medium w-8">#</th>
                    <th className="py-2 pr-3 font-medium">クエリ</th>
                    <th className="py-2 font-medium text-right">結果件数</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-1.5 pr-3 text-gray-500">{i + 1}</td>
                      <td className="py-1.5 pr-3 text-gray-200 font-mono text-xs">
                        {q.query}
                      </td>
                      <td className="py-1.5 text-right text-gray-300">
                        {q.resultCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SearchLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const limit = 20

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchJobs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/search-logs?page=${p}&limit=${limit}`)
      const data = await res.json()
      setJobs(data.jobs ?? [])
      setTotal(data.total ?? 0)
      setPage(data.page ?? p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchJobs(1)
    }
  }, [status, fetchJobs])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">検索ログ</h1>
            <p className="text-sm text-gray-400">
              全 {total.toLocaleString()} 件のジョブ
            </p>
          </div>
          <button
            onClick={() => fetchJobs(page)}
            className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors"
          >
            更新
          </button>
        </div>

        {/* テーブル */}
        <div className="bg-[#16161f] border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400">読み込み中...</div>
          ) : jobs.length === 0 ? (
            <div className="py-20 text-center text-gray-400">ジョブがありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0e0e18]">
                    <th className="text-left text-xs font-medium text-gray-400 py-3 px-4 whitespace-nowrap">ジョブID</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">ユーザー</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">キーワード</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">業種/地域</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">目標件数</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">収集数</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">ステータス</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">作成日時</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">クエリ数</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 whitespace-nowrap">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => fetchJobs(page - 1)}
              disabled={page <= 1}
              className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              前へ
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => fetchJobs(page + 1)}
              disabled={page >= totalPages}
              className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
