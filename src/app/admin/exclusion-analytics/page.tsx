'use client'

import { useEffect, useState } from 'react'

// ---- Types ------------------------------------------------------------------

interface Summary {
  totalExcluded: number
  totalCollected: number
  exclusionRate: number
  confirmedJobs: number
}

interface DomainRow {
  domain: string
  count: number
}

interface IndustryRow {
  industry: string
  excluded: number
  total: number
  rate: number
}

interface RecentRow {
  companyName: string | null
  domain: string
  industry: string | null
  excludedAt: string
}

interface ExclusionData {
  summary: Summary
  domainRanking: DomainRow[]
  industryStats: IndustryRow[]
  recentExcluded: RecentRow[]
}

// ---- Helpers ----------------------------------------------------------------

function fmt(n: number) {
  return n.toLocaleString()
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- Sub components ---------------------------------------------------------

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'red' | 'blue' | 'gray'
}) {
  const colors = {
    red: 'text-red-400',
    blue: 'text-blue-400',
    gray: 'text-white',
  }
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent]}`}>{value}</p>
    </div>
  )
}

// ---- Main Page --------------------------------------------------------------

export default function ExclusionAnalyticsPage() {
  const [data, setData] = useState<ExclusionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/exclusion-analytics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError('データ取得に失敗しました')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const s = data?.summary

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">除外分析</h1>
            <p className="text-sm text-gray-400">
              除外ドメイン・業種別除外率・最近の除外企業
            </p>
          </div>
          <button
            onClick={fetchData}
            className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors"
          >
            更新
          </button>
        </div>

        {/* ---- Error ---- */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-gray-400">読み込み中...</div>
        ) : (
          <>
            {/* ---- KPI cards ---- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="総除外数"
                value={s ? fmt(s.totalExcluded) : '---'}
                accent="red"
              />
              <KpiCard
                label="総収集数"
                value={s ? fmt(s.totalCollected) : '---'}
                accent="blue"
              />
              <KpiCard
                label="除外率"
                value={s ? fmtPct(s.exclusionRate) : '---'}
                accent="red"
              />
              <KpiCard
                label="確定済みジョブ数"
                value={s ? fmt(s.confirmedJobs) : '---'}
                accent="gray"
              />
            </div>

            {/* ---- Domain ranking ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                頻出除外ドメインランキング（TOP 20）
              </h2>
              {data?.domainRanking && data.domainRanking.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-2 pr-4 font-medium text-xs w-12">
                          #
                        </th>
                        <th className="text-left py-2 pr-4 font-medium text-xs">
                          ドメイン
                        </th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">
                          除外回数
                        </th>
                        <th className="text-right py-2 font-medium text-xs">
                          アクション
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.domainRanking.map((d, i) => (
                        <tr
                          key={d.domain}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-2 pr-4 text-gray-500 text-xs">
                            {i + 1}
                          </td>
                          <td className="py-2 pr-4 text-gray-200 text-xs font-mono">
                            {d.domain}
                          </td>
                          <td className="py-2 pr-4 text-right text-red-400 text-xs font-mono">
                            {fmt(d.count)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              disabled
                              className="text-xs text-gray-600 border border-white/5 rounded px-2 py-1 cursor-not-allowed"
                              title="Phase 2 で実装予定"
                            >
                              BLに追加
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">データなし</p>
              )}
            </div>

            {/* ---- Industry exclusion rate ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                業種別の除外率
              </h2>
              {data?.industryStats && data.industryStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-2 pr-4 font-medium text-xs">
                          業種
                        </th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">
                          除外数
                        </th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">
                          総収集数
                        </th>
                        <th className="text-right py-2 font-medium text-xs">
                          除外率
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.industryStats.map((row) => (
                        <tr
                          key={row.industry}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-2 pr-4 text-gray-200 text-xs">
                            {row.industry}
                          </td>
                          <td className="py-2 pr-4 text-right text-red-400 text-xs font-mono">
                            {fmt(row.excluded)}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono">
                            {fmt(row.total)}
                          </td>
                          <td className="py-2 text-right text-xs font-mono">
                            <span
                              className={
                                row.rate > 30 ? 'text-red-400' : row.rate > 15 ? 'text-yellow-400' : 'text-green-400'
                              }
                            >
                              {fmtPct(row.rate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">データなし</p>
              )}
            </div>

            {/* ---- Recent excluded companies ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">
                最近の除外企業（直近50件）
              </h2>
              {data?.recentExcluded && data.recentExcluded.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-2 pr-4 font-medium text-xs">
                          企業名
                        </th>
                        <th className="text-left py-2 pr-4 font-medium text-xs">
                          ドメイン
                        </th>
                        <th className="text-left py-2 pr-4 font-medium text-xs">
                          依頼業種
                        </th>
                        <th className="text-right py-2 font-medium text-xs">
                          除外日時
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentExcluded.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-2 pr-4 text-gray-200 text-xs max-w-[200px] truncate">
                            {row.companyName ?? '---'}
                          </td>
                          <td className="py-2 pr-4 text-gray-400 text-xs font-mono max-w-[200px] truncate">
                            {row.domain}
                          </td>
                          <td className="py-2 pr-4 text-gray-300 text-xs">
                            {row.industry ?? '---'}
                          </td>
                          <td className="py-2 text-right text-gray-500 text-xs font-mono">
                            {fmtDate(row.excludedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">データなし</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
