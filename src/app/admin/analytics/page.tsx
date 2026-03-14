'use client'

import { useEffect, useState, useCallback } from 'react'

// ---- Types ----------------------------------------------------------------

interface Summary {
  totalRevenue: number
  monthlyRevenue: number
  totalPurchases: number
  totalUsers: number
  totalJobs: number
  completedJobs: number
  cancelledJobs: number
}

interface Funnel {
  richMenuClicks: number
  jobsCreated: number
  jobsCompleted: number
  purchases: number
  shiryologSignups: number
}

interface DailyRow {
  date: string
  revenue: number
  jobs: number
  newUsers: number
}

interface CampaignRow {
  campaign: string
  impressions: number
  clicks: number
  spend: number
  ctr: number
  cpc: number
}

interface AnalyticsData {
  summary: Summary
  funnel: Funnel
  daily: DailyRow[]
  campaigns: CampaignRow[]
}

interface AdForm {
  date: string
  campaign: string
  impressions: string
  clicks: string
  spend: string
}

// ---- Helpers ---------------------------------------------------------------

function fmt(n: number) {
  return n.toLocaleString()
}

function fmtYen(n: number) {
  return `¥${n.toLocaleString()}`
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}

function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return fmtPct((num / den) * 100)
}

function getDateRange(preset: string): { from: string; to: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt2 = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const to = fmt2(today)

  if (preset === '7d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 6)
    return { from: fmt2(from), to }
  }
  if (preset === '30d') {
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    return { from: fmt2(from), to }
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt2(from), to }
  }
  return { from: to, to }
}

// ---- Sub components --------------------------------------------------------

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'green' | 'blue' | 'gray'
}) {
  const colors = {
    green: 'text-green-400',
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

function FunnelStep({
  label,
  value,
  rate,
  isLast,
}: {
  label: string
  value: number
  rate?: string
  isLast?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-6 py-3 w-full text-center">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-xl font-bold text-white">{fmt(value)} 件</p>
      </div>
      {!isLast && (
        <div className="flex flex-col items-center my-1">
          <div className="w-px h-4 bg-white/20" />
          <p className="text-xs text-gray-500">{rate ?? '—'}</p>
          <div className="w-px h-4 bg-white/20" />
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white/20" />
        </div>
      )}
    </div>
  )
}

// ---- Main Page -------------------------------------------------------------

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<'7d' | '30d' | 'month' | 'custom'>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Ad form state
  const [adFormOpen, setAdFormOpen] = useState(false)
  const [adForm, setAdForm] = useState<AdForm>({
    date: new Date().toISOString().slice(0, 10),
    campaign: '',
    impressions: '',
    clicks: '',
    spend: '',
  })
  const [adSaving, setAdSaving] = useState(false)
  const [adMsg, setAdMsg] = useState('')

  const getRange = useCallback((): { from: string; to: string } => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return getDateRange(preset)
  }, [preset, customFrom, customTo])

  const fetchData = useCallback(async () => {
    const { from, to } = getRange()
    if (!from || !to) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/analytics?from=${from}&to=${to}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError('データ取得に失敗しました')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [getRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Ad form submit -------------------------------------------------------
  async function submitAdForm(e: React.FormEvent) {
    e.preventDefault()
    setAdSaving(true)
    setAdMsg('')
    try {
      const res = await fetch('/api/admin/ad-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: adForm.date,
          campaign: adForm.campaign,
          impressions: Number(adForm.impressions),
          clicks: Number(adForm.clicks),
          spend: Number(adForm.spend),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAdMsg('保存しました')
      setAdForm((f) => ({ ...f, campaign: '', impressions: '', clicks: '', spend: '' }))
      fetchData()
    } catch {
      setAdMsg('保存に失敗しました')
    } finally {
      setAdSaving(false)
    }
  }

  // ---- Summary derived values ----------------------------------------------
  const s = data?.summary
  const completionRate =
    s && s.totalJobs > 0 ? ((s.completedJobs / s.totalJobs) * 100).toFixed(1) : '—'

  const f = data?.funnel

  // ---- Max revenue for bar chart ------------------------------------------
  const maxRevenue = data?.daily
    ? Math.max(...data.daily.map((d) => d.revenue), 1)
    : 1

  // ---- ROAS ----------------------------------------------------------------
  // Total revenue in range / total ad spend
  const totalAdSpend = data?.campaigns?.reduce((acc, c) => acc + c.spend, 0) ?? 0
  const roas =
    s && totalAdSpend > 0 ? ((s.totalRevenue / totalAdSpend) * 100).toFixed(0) : '—'

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">

        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">アナリティクス</h1>
            <p className="text-sm text-gray-400">売上・依頼・広告パフォーマンスの一覧</p>
          </div>
          <button
            onClick={fetchData}
            className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors"
          >
            更新
          </button>
        </div>

        {/* ---- Period filter ---- */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['7d', '30d', 'month', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                  preset === p
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                }`}
              >
                {p === '7d' ? '過去7日' : p === '30d' ? '過去30日' : p === 'month' ? '今月' : 'カスタム'}
              </button>
            ))}

            {preset === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-[#111] border border-white/20 text-white text-sm rounded px-2 py-1"
                />
                <span className="text-gray-500">〜</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-[#111] border border-white/20 text-white text-sm rounded px-2 py-1"
                />
                <button
                  onClick={fetchData}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                >
                  適用
                </button>
              </div>
            )}
          </div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard label="総売上" value={s ? fmtYen(s.totalRevenue) : '—'} accent="green" />
              <KpiCard label="今月売上" value={s ? fmtYen(s.monthlyRevenue) : '—'} accent="green" />
              <KpiCard label="総依頼件数" value={s ? fmt(s.totalJobs) : '—'} accent="blue" />
              <KpiCard
                label="完了率"
                value={completionRate === '—' ? '—' : `${completionRate}%`}
                accent="blue"
              />
              <KpiCard label="総ユーザー数" value={s ? fmt(s.totalUsers) : '—'} accent="gray" />
              <KpiCard label="課金件数" value={s ? fmt(s.totalPurchases) : '—'} accent="gray" />
            </div>

            {/* ---- Funnel ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-6">コンバージョンファネル</h2>
              {f ? (
                <div className="flex flex-col max-w-sm mx-auto">
                  <FunnelStep
                    label="リッチメニュークリック"
                    value={f.richMenuClicks}
                    rate={pct(f.jobsCreated, f.richMenuClicks)}
                  />
                  <FunnelStep
                    label="依頼作成"
                    value={f.jobsCreated}
                    rate={pct(f.jobsCompleted, f.jobsCreated)}
                  />
                  <FunnelStep
                    label="依頼完了"
                    value={f.jobsCompleted}
                    rate={pct(f.purchases, f.jobsCompleted)}
                  />
                  <FunnelStep
                    label="課金"
                    value={f.purchases}
                    rate={pct(f.shiryologSignups, f.purchases)}
                  />
                  <FunnelStep
                    label="シリョログ登録"
                    value={f.shiryologSignups}
                    isLast
                  />
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">データなし</p>
              )}
            </div>

            {/* ---- Daily table + bar chart ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-300 mb-6">日別パフォーマンス</h2>

              {data?.daily && data.daily.length > 0 ? (
                <>
                  {/* Mini bar chart: revenue bars */}
                  <div className="mb-6">
                    <p className="text-xs text-gray-500 mb-2">売上推移（バー）</p>
                    <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                      {data.daily.map((d) => (
                        <div
                          key={d.date}
                          className="flex flex-col items-center gap-1 flex-shrink-0"
                          style={{ minWidth: '28px' }}
                        >
                          <div
                            className="w-full bg-green-500/70 hover:bg-green-400 transition-colors rounded-t"
                            style={{
                              height: `${Math.max(2, (d.revenue / maxRevenue) * 80)}px`,
                            }}
                            title={`${d.date}: ${fmtYen(d.revenue)}`}
                          />
                          <span className="text-[9px] text-gray-600 rotate-90 whitespace-nowrap origin-center mt-2 inline-block">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400">
                          <th className="text-left py-2 pr-4 font-medium text-xs">日付</th>
                          <th className="text-right py-2 pr-4 font-medium text-xs">売上</th>
                          <th className="text-right py-2 pr-4 font-medium text-xs">依頼件数</th>
                          <th className="text-right py-2 font-medium text-xs">新規ユーザー</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily.map((d) => (
                          <tr
                            key={d.date}
                            className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="py-2 pr-4 text-gray-300 text-xs">{d.date}</td>
                            <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono">
                              {fmtYen(d.revenue)}
                            </td>
                            <td className="py-2 pr-4 text-right text-blue-400 text-xs font-mono">
                              {fmt(d.jobs)}
                            </td>
                            <td className="py-2 text-right text-gray-300 text-xs font-mono">
                              {fmt(d.newUsers)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/20">
                          <td className="py-2 pr-4 text-xs text-gray-400 font-medium">合計</td>
                          <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono font-medium">
                            {fmtYen(data.daily.reduce((a, d) => a + d.revenue, 0))}
                          </td>
                          <td className="py-2 pr-4 text-right text-blue-400 text-xs font-mono font-medium">
                            {fmt(data.daily.reduce((a, d) => a + d.jobs, 0))}
                          </td>
                          <td className="py-2 text-right text-gray-300 text-xs font-mono font-medium">
                            {fmt(data.daily.reduce((a, d) => a + d.newUsers, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center">データなし</p>
              )}
            </div>

            {/* ---- Ad performance ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-gray-300">広告パフォーマンス</h2>
                {totalAdSpend > 0 && (
                  <span className="text-xs text-gray-400">
                    総ROAS:{' '}
                    <span className="text-green-400 font-mono">{roas}%</span>
                  </span>
                )}
              </div>

              {data?.campaigns && data.campaigns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400">
                        <th className="text-left py-2 pr-4 font-medium text-xs">キャンペーン</th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">IMP</th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">クリック</th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">費用</th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">CTR</th>
                        <th className="text-right py-2 pr-4 font-medium text-xs">CPC</th>
                        <th className="text-right py-2 font-medium text-xs">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((c, i) => {
                        const campaignRoas =
                          c.spend > 0 && s
                            ? ((s.totalRevenue / c.spend) * 100).toFixed(0)
                            : '—'
                        return (
                          <tr
                            key={i}
                            className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="py-2 pr-4 text-gray-200 text-xs max-w-[200px] truncate">
                              {c.campaign}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono">
                              {fmt(c.impressions)}
                            </td>
                            <td className="py-2 pr-4 text-right text-blue-400 text-xs font-mono">
                              {fmt(c.clicks)}
                            </td>
                            <td className="py-2 pr-4 text-right text-red-400 text-xs font-mono">
                              {fmtYen(c.spend)}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono">
                              {fmtPct(c.ctr)}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono">
                              {fmtYen(Math.round(c.cpc))}
                            </td>
                            <td className="py-2 text-right text-xs font-mono">
                              <span
                                className={
                                  campaignRoas !== '—' && Number(campaignRoas) >= 100
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }
                              >
                                {campaignRoas === '—' ? '—' : `${campaignRoas}%`}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td className="py-2 pr-4 text-xs text-gray-400 font-medium">合計</td>
                        <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono font-medium">
                          {fmt(data.campaigns.reduce((a, c) => a + c.impressions, 0))}
                        </td>
                        <td className="py-2 pr-4 text-right text-blue-400 text-xs font-mono font-medium">
                          {fmt(data.campaigns.reduce((a, c) => a + c.clicks, 0))}
                        </td>
                        <td className="py-2 pr-4 text-right text-red-400 text-xs font-mono font-medium">
                          {fmtYen(data.campaigns.reduce((a, c) => a + c.spend, 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center">広告データなし</p>
              )}
            </div>

            {/* ---- Ad data entry form ---- */}
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setAdFormOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm text-gray-300 hover:text-white hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-semibold">広告データ手動入力</span>
                <span className="text-gray-500">{adFormOpen ? '▲ 閉じる' : '▼ 開く'}</span>
              </button>

              {adFormOpen && (
                <form onSubmit={submitAdForm} className="px-6 pb-6 pt-2 border-t border-white/10">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">日付</label>
                      <input
                        type="date"
                        required
                        value={adForm.date}
                        onChange={(e) => setAdForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full bg-[#111] border border-white/20 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1 lg:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">キャンペーン名</label>
                      <input
                        type="text"
                        required
                        placeholder="例: LINE広告_オートリスト"
                        value={adForm.campaign}
                        onChange={(e) => setAdForm((f) => ({ ...f, campaign: e.target.value }))}
                        className="w-full bg-[#111] border border-white/20 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">インプレッション</label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="10000"
                        value={adForm.impressions}
                        onChange={(e) => setAdForm((f) => ({ ...f, impressions: e.target.value }))}
                        className="w-full bg-[#111] border border-white/20 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">クリック数</label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="300"
                        value={adForm.clicks}
                        onChange={(e) => setAdForm((f) => ({ ...f, clicks: e.target.value }))}
                        className="w-full bg-[#111] border border-white/20 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">費用（円）</label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="50000"
                        value={adForm.spend}
                        onChange={(e) => setAdForm((f) => ({ ...f, spend: e.target.value }))}
                        className="w-full bg-[#111] border border-white/20 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={adSaving}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded transition-colors"
                    >
                      {adSaving ? '保存中...' : '保存する'}
                    </button>
                    {adMsg && (
                      <p
                        className={`text-sm ${
                          adMsg.includes('失敗') ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {adMsg}
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
