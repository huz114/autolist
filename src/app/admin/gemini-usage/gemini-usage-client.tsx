'use client'

import Link from 'next/link'
import type { GeminiUsageData, SourceBreakdown, JobUsage } from './page'

// --- Helpers ---

function fmtYen(n: number): string {
  if (n < 1) return `¥${n.toFixed(4)}`
  return `¥${n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmt(n: number): string {
  return n.toLocaleString()
}

const SOURCE_LABELS: Record<string, string> = {
  analyzeQuery: 'analyzeQuery',
  scrapeCompany: 'scrapeCompany',
  suggestKeywords: 'suggestKeywords',
  compose: 'compose',
}

const SOURCE_COLORS: Record<string, string> = {
  analyzeQuery: 'text-blue-400',
  scrapeCompany: 'text-green-400',
  suggestKeywords: 'text-purple-400',
  compose: 'text-amber-400',
}

const BAR_COLORS: Record<string, string> = {
  analyzeQuery: 'bg-blue-500/70',
  scrapeCompany: 'bg-green-500/70',
  suggestKeywords: 'bg-purple-500/70',
  compose: 'bg-amber-500/70',
}

// --- Sub Components ---

function StatCard({
  label,
  value,
  accent = 'white',
}: {
  label: string
  value: string
  accent?: 'green' | 'blue' | 'purple' | 'white'
}) {
  const colors = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    white: 'text-white',
  }
  return (
    <div className="bg-[#16161f] border border-white/10 rounded-xl p-5">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${colors[accent]}`}>{value}</p>
    </div>
  )
}

function SourceTable({ sources }: { sources: SourceBreakdown[] }) {
  if (sources.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">データなし</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-gray-400">
            <th className="text-left py-2 pr-4 font-medium text-xs">Source</th>
            <th className="text-right py-2 pr-4 font-medium text-xs">リクエスト数</th>
            <th className="text-right py-2 pr-4 font-medium text-xs">合計コスト</th>
            <th className="text-right py-2 font-medium text-xs">平均コスト</th>
          </tr>
        </thead>
        <tbody>
          {sources
            .sort((a, b) => b.totalCost - a.totalCost)
            .map((s) => (
              <tr
                key={s.source}
                className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
              >
                <td className="py-2 pr-4">
                  <span className={`text-xs font-mono ${SOURCE_COLORS[s.source] || 'text-gray-300'}`}>
                    {SOURCE_LABELS[s.source] || s.source}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono">
                  {fmt(s.count)}
                </td>
                <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono">
                  {fmtYen(s.totalCost)}
                </td>
                <td className="py-2 text-right text-gray-300 text-xs font-mono">
                  {fmtYen(s.avgCost)}
                </td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/20">
            <td className="py-2 pr-4 text-xs text-gray-400 font-medium">合計</td>
            <td className="py-2 pr-4 text-right text-gray-300 text-xs font-mono font-medium">
              {fmt(sources.reduce((a, s) => a + s.count, 0))}
            </td>
            <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono font-medium">
              {fmtYen(sources.reduce((a, s) => a + s.totalCost, 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DailyChart({ daily }: { daily: GeminiUsageData['daily'] }) {
  if (daily.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">データなし</p>
  }

  const maxCost = Math.max(...daily.map((d) => d.cost), 0.001)

  return (
    <div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
        {daily.map((d) => {
          const height = Math.max(2, (d.cost / maxCost) * 112)
          return (
            <div
              key={d.date}
              className="flex flex-col items-center gap-1 flex-shrink-0 group relative"
              style={{ minWidth: '24px' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-[#0a0f1c] border border-white/20 rounded px-2 py-1 text-[10px] text-gray-300 whitespace-nowrap shadow-lg">
                  <div>{d.date}</div>
                  <div className="text-green-400">{fmtYen(d.cost)}</div>
                  <div className="text-blue-400">{d.count}件</div>
                </div>
              </div>
              <div
                className="w-full bg-green-500/70 hover:bg-green-400 transition-colors rounded-t cursor-pointer"
                style={{ height: `${height}px` }}
              />
              <span className="text-[8px] text-gray-600 whitespace-nowrap">
                {d.date.slice(8)}
              </span>
            </div>
          )
        })}
      </div>
      {/* X-axis label */}
      <div className="flex justify-between mt-1 px-1">
        <span className="text-[10px] text-gray-500">{daily[0]?.date.slice(5)}</span>
        <span className="text-[10px] text-gray-500">{daily[daily.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

function JobTable({ jobs }: { jobs: JobUsage[] }) {
  if (jobs.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">データなし</p>
  }

  const allSources = Array.from(
    new Set(jobs.flatMap((j) => Object.keys(j.sources)))
  ).sort()

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-gray-400">
            <th className="text-left py-2 pr-3 font-medium text-xs">キーワード</th>
            <th className="text-left py-2 pr-3 font-medium text-xs">業種</th>
            <th className="text-left py-2 pr-3 font-medium text-xs">地域</th>
            <th className="text-right py-2 pr-3 font-medium text-xs">件数</th>
            <th className="text-right py-2 pr-3 font-medium text-xs">合計コスト</th>
            <th className="text-left py-2 font-medium text-xs">Source別内訳</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr
              key={j.jobId}
              className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
            >
              <td className="py-2 pr-3 text-gray-200 text-xs max-w-[160px] truncate">
                {j.keyword}
              </td>
              <td className="py-2 pr-3 text-gray-400 text-xs max-w-[100px] truncate">
                {j.industry || '-'}
              </td>
              <td className="py-2 pr-3 text-gray-400 text-xs max-w-[80px] truncate">
                {j.location || '-'}
              </td>
              <td className="py-2 pr-3 text-right text-gray-300 text-xs font-mono">
                {fmt(j.count)}
              </td>
              <td className="py-2 pr-3 text-right text-green-400 text-xs font-mono">
                {fmtYen(j.totalCost)}
              </td>
              <td className="py-2 text-xs">
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {allSources.map((src) => {
                    const cost = j.sources[src]
                    if (!cost) return null
                    return (
                      <span key={src} className="whitespace-nowrap">
                        <span className={`${SOURCE_COLORS[src] || 'text-gray-400'}`}>
                          {SOURCE_LABELS[src] || src}
                        </span>
                        <span className="text-gray-500 ml-1 font-mono">{fmtYen(cost)}</span>
                      </span>
                    )
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Main Component ---

export function GeminiUsageClient({ data }: { data: GeminiUsageData }) {
  const isCurrentMonth = data.period === 'current'

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Gemini API コスト</h1>
            <p className="text-sm text-gray-400">
              {data.periodLabel} のAPI使用状況・コスト分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={isCurrentMonth ? '/admin/gemini-usage?month=previous' : '/admin/gemini-usage'}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                !isCurrentMonth
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              先月
            </Link>
            <Link
              href="/admin/gemini-usage"
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                isCurrentMonth
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/30'
              }`}
            >
              今月
            </Link>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="合計コスト" value={fmtYen(data.totalCost)} accent="green" />
          <StatCard label="合計リクエスト数" value={fmt(data.totalRequests)} accent="blue" />
          <StatCard
            label="平均コスト/リクエスト"
            value={fmtYen(data.avgCostPerRequest)}
            accent="purple"
          />
          <StatCard label="最高コストSource" value={data.topSource} accent="white" />
        </div>

        {/* Source Breakdown */}
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Source別内訳</h2>
          <SourceTable sources={data.sourceBreakdown} />
        </div>

        {/* Daily Chart */}
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">日別コスト推移</h2>
          <DailyChart daily={data.daily} />
          {/* Daily detail table */}
          {data.daily.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="text-left py-2 pr-4 font-medium text-xs">日付</th>
                    <th className="text-right py-2 pr-4 font-medium text-xs">コスト</th>
                    <th className="text-right py-2 font-medium text-xs">リクエスト数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily
                    .filter((d) => d.count > 0)
                    .map((d) => (
                      <tr
                        key={d.date}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-1.5 pr-4 text-gray-300 text-xs">{d.date}</td>
                        <td className="py-1.5 pr-4 text-right text-green-400 text-xs font-mono">
                          {fmtYen(d.cost)}
                        </td>
                        <td className="py-1.5 text-right text-blue-400 text-xs font-mono">
                          {fmt(d.count)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/20">
                    <td className="py-2 pr-4 text-xs text-gray-400 font-medium">合計</td>
                    <td className="py-2 pr-4 text-right text-green-400 text-xs font-mono font-medium">
                      {fmtYen(data.daily.reduce((a, d) => a + d.cost, 0))}
                    </td>
                    <td className="py-2 text-right text-blue-400 text-xs font-mono font-medium">
                      {fmt(data.daily.reduce((a, d) => a + d.count, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Job Cost Table */}
        <div className="bg-[#16161f] border border-white/10 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">
            ジョブ別コスト（Top 20）
          </h2>
          <JobTable jobs={data.jobs} />
        </div>
      </div>
    </div>
  )
}
