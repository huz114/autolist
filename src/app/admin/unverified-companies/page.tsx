'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Job {
  keyword: string
  createdAt: string
  userId: string
}

interface UnverifiedUrl {
  id: string
  url: string
  domain: string
  companyName: string | null
  createdAt: string
  job: Job
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

export default function UnverifiedCompaniesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [items, setItems] = useState<UnverifiedUrl[]>([])
  const [total, setTotal] = useState(0)
  const [verifiedTotal, setVerifiedTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/unverified-companies?take=100')
      const data = await res.json()
      setItems(data.unverified ?? [])
      setTotal(data.total ?? 0)
      setVerifiedTotal(data.verifiedTotal ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, fetchData])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  // ジョブIDごとにグルーピング
  const grouped: Map<string, { job: Job; urls: UnverifiedUrl[] }> = new Map()
  for (const item of items) {
    const key = item.job.userId + '_' + item.job.keyword + '_' + item.job.createdAt
    if (!grouped.has(key)) {
      grouped.set(key, { job: item.job, urls: [] })
    }
    grouped.get(key)!.urls.push(item)
  }

  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* ヘッダー */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">未確認企業レビュー</h1>
            <p className="text-sm text-gray-400">
              法人名が取得できなかった企業の一覧（hasForm=true かつ companyVerified=false）
            </p>
          </div>
          <button
            onClick={fetchData}
            className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors"
          >
            更新
          </button>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">未確認（レビュー待ち）</p>
            <p className="text-2xl font-bold text-red-400">{total.toLocaleString()}</p>
          </div>
          <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">確認済み（顧客提出可）</p>
            <p className="text-2xl font-bold text-emerald-400">{verifiedTotal.toLocaleString()}</p>
          </div>
          <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">確認率</p>
            <p className="text-2xl font-bold text-white">
              {total + verifiedTotal > 0
                ? Math.round((verifiedTotal / (total + verifiedTotal)) * 100)
                : 0}%
            </p>
          </div>
        </div>

        {/* 一覧 */}
        {loading ? (
          <div className="bg-[#16161f] border border-white/10 rounded-xl py-20 text-center text-gray-400">
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#16161f] border border-white/10 rounded-xl py-20 text-center">
            <p className="text-emerald-400 font-medium mb-1">未確認企業はありません</p>
            <p className="text-sm text-gray-500">全件の法人名が取得済みです</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([key, { job, urls }]) => (
              <div key={key} className="bg-[#16161f] border border-white/10 rounded-xl overflow-hidden">
                {/* ジョブヘッダー */}
                <div className="bg-[#0e0e18] px-5 py-3 flex flex-wrap items-center gap-3 border-b border-white/10">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-300">
                    {job.keyword}
                  </span>
                  <span className="text-xs text-gray-500">
                    依頼日: {formatJst(job.createdAt)}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    未確認 <span className="text-red-400 font-medium">{urls.length}</span> 件
                  </span>
                </div>

                {/* URLテーブル */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="py-2 px-4 font-medium">ドメイン</th>
                        <th className="py-2 pr-4 font-medium">URL</th>
                        <th className="py-2 pr-4 font-medium">取得済み社名</th>
                        <th className="py-2 pr-4 font-medium whitespace-nowrap">収集日時</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urls.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="py-2 px-4 text-gray-300 max-w-[160px] truncate">
                            {u.domain}
                          </td>
                          <td className="py-2 pr-4 max-w-[240px]">
                            <a
                              href={u.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline truncate block"
                            >
                              {u.url}
                            </a>
                          </td>
                          <td className="py-2 pr-4 max-w-[200px]">
                            {u.companyName ? (
                              <span className="text-gray-200 truncate block">{u.companyName}</span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                            {formatJst(u.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 100 && (
          <p className="text-xs text-gray-600 text-center mt-4">
            直近100件を表示しています（全 {total.toLocaleString()} 件）
          </p>
        )}
      </div>
    </div>
  )
}
