'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ShiryologUser {
  name: string | null
  email: string | null
  companyName: string | null
  phone: string | null
}

interface LineUser {
  id: string
  displayName: string | null
  lineUserId: string
  shiryologUser: ShiryologUser | null
}

interface Job {
  id: string
  originalMessage: string | null
  keyword: string
  industry: string | null
  location: string | null
  targetCount: number
  status: string
  progress: number
  totalFound: number
  createdAt: string
  completedAt: string | null
  user: LineUser
  _count: { urls: number }
}

interface CollectedUrl {
  id: string
  companyName: string | null
  url: string
  phoneNumber: string | null
  formUrl: string | null
  hasForm: boolean
  status: string
  createdAt: string
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

function UrlsTable({ jobId }: { jobId: string }) {
  const [urls, setUrls] = useState<CollectedUrl[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/requests/${jobId}/urls`)
      .then((r) => r.json())
      .then((data) => {
        setUrls(data.urls ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [jobId])

  if (loading) {
    return <p className="text-sm text-gray-500 py-4 text-center">読み込み中...</p>
  }
  if (!urls || urls.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">URLが見つかりません</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b border-white/10 text-gray-400">
            <th className="py-2 pr-3 font-medium">会社名</th>
            <th className="py-2 pr-3 font-medium">URL</th>
            <th className="py-2 pr-3 font-medium">電話番号</th>
            <th className="py-2 pr-3 font-medium">フォームURL</th>
            <th className="py-2 font-medium">フォームあり</th>
          </tr>
        </thead>
        <tbody>
          {urls.map((u) => (
            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
              <td className="py-1.5 pr-3 text-gray-200 max-w-[140px] truncate">
                {u.companyName ?? '-'}
              </td>
              <td className="py-1.5 pr-3 max-w-[200px]">
                <a
                  href={u.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate block"
                >
                  {u.url}
                </a>
              </td>
              <td className="py-1.5 pr-3 text-gray-300">{u.phoneNumber ?? '-'}</td>
              <td className="py-1.5 pr-3 max-w-[160px]">
                {u.formUrl ? (
                  <a
                    href={u.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline truncate block"
                  >
                    {u.formUrl}
                  </a>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </td>
              <td className="py-1.5">
                {u.hasForm ? (
                  <span className="text-green-400 bg-green-900/40 text-xs px-1.5 py-0.5 rounded">
                    あり
                  </span>
                ) : (
                  <span className="text-gray-600 text-xs">なし</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-white/10 hover:bg-white/[0.03] transition-colors">
        {/* 依頼日時 */}
        <td className="py-3 pr-4 text-sm text-gray-300 whitespace-nowrap">
          {formatJst(job.createdAt)}
        </td>
        {/* 依頼者 */}
        <td className="py-3 pr-4 text-sm text-gray-200 max-w-[180px]">
          {job.user.shiryologUser ? (
            <div className="space-y-0.5">
              <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 mb-0.5">
                ✓ シリョログ登録済
              </span>
              <p className="truncate text-gray-200">{job.user.displayName ?? job.user.lineUserId}</p>
              {job.user.shiryologUser.name && (
                <p className="text-xs text-gray-400 truncate">{job.user.shiryologUser.name}</p>
              )}
              {job.user.shiryologUser.companyName && (
                <p className="text-xs text-gray-500 truncate">{job.user.shiryologUser.companyName}</p>
              )}
              {job.user.shiryologUser.email && (
                <p className="text-xs text-gray-500 truncate">{job.user.shiryologUser.email}</p>
              )}
              {job.user.shiryologUser.phone && (
                <p className="text-xs text-gray-500 truncate">{job.user.shiryologUser.phone}</p>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 mb-0.5">
                未登録
              </span>
              <p className="truncate text-gray-200">{job.user.displayName ?? job.user.lineUserId}</p>
            </div>
          )}
        </td>
        {/* 依頼内容（元文面） */}
        <td className="py-3 pr-4 text-sm text-gray-300 max-w-[180px]">
          <span className="block truncate" title={job.originalMessage ?? undefined}>
            {job.originalMessage ?? <span className="text-gray-600">-</span>}
          </span>
        </td>
        {/* 解析結果 */}
        <td className="py-3 pr-4">
          <div className="flex flex-wrap gap-1">
            {job.keyword && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300">
                {job.keyword}
              </span>
            )}
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
        {/* 件数 */}
        <td className="py-3 pr-4 text-sm text-gray-200 text-right whitespace-nowrap">
          {job.targetCount.toLocaleString()}
        </td>
        {/* ステータス */}
        <td className="py-3 pr-4">
          <StatusBadge status={job.status} />
        </td>
        {/* 収集数 */}
        <td className="py-3 pr-4 text-sm text-gray-200 text-right whitespace-nowrap">
          {job.totalFound.toLocaleString()}
        </td>
        {/* 詳細 */}
        <td className="py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-2.5 py-1 rounded transition-colors whitespace-nowrap"
          >
            {expanded ? '▲ 閉じる' : '▼ 詳細'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/10">
          <td colSpan={8} className="bg-[#0e0e18] px-6 py-4">
            {job.completedAt && (
              <p className="text-xs text-gray-500 mb-3">
                完了日時: {formatJst(job.completedAt)}
              </p>
            )}
            <UrlsTable jobId={job.id} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function RequestsPage() {
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
      const res = await fetch(`/api/admin/requests?page=${p}&limit=${limit}`)
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
            <h1 className="text-2xl font-bold text-white mb-1">依頼管理</h1>
            <p className="text-sm text-gray-400">
              全 {total.toLocaleString()} 件の依頼
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
            <div className="py-20 text-center text-gray-400">依頼がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0e0e18]">
                    <th className="text-left text-xs font-medium text-gray-400 py-3 px-4 whitespace-nowrap">依頼日時</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">依頼者</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">依頼内容（元文面）</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">解析結果</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">件数</th>
                    <th className="text-left text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">ステータス</th>
                    <th className="text-right text-xs font-medium text-gray-400 py-3 pr-4 whitespace-nowrap">収集数</th>
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
