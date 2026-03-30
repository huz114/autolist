'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type HistoryEntry = {
  type: 'purchase' | 'usage' | 'refund'
  date: string
  credits: number
  description: string
  amount?: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${day} ${h}:${min}`
}

function formatAmount(amount: number): string {
  return `\u00a5${amount.toLocaleString()}`
}

export default function CreditsPage() {
  const [currentCredits, setCurrentCredits] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/user/credit-history')
      .then(r => {
        if (!r.ok) throw new Error('Unauthorized')
        return r.json()
      })
      .then(data => {
        setCurrentCredits(data.currentCredits)
        setHistory(data.history || [])
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 残高カード */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[#8494a7] text-sm mb-1">残クレジット</p>
            {loading ? (
              <div className="h-10 w-40 bg-[#1a2234] rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-black text-[#f0f4f8]">
                <span className="mr-2">💳</span>
                {currentCredits !== null ? currentCredits.toLocaleString() : '--'}
                <span className="text-lg font-normal text-[#8494a7] ml-1">件</span>
              </p>
            )}
          </div>
          <Link
            href="/purchase"
            className="inline-flex items-center justify-center text-sm bg-[#06C755] hover:bg-[#04a344] text-white px-6 py-2.5 rounded-full font-bold transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.5)]"
          >
            チャージする
          </Link>
        </div>
      </div>

      {/* 履歴セクション */}
      <h2 className="text-lg font-bold text-[#f0f4f8] mb-4">クレジット履歴</h2>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[#1a2234] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-[#1a2234] rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-[#1a2234] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center">
          <p className="text-[#8494a7]">{error}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center">
          <p className="text-[#8494a7] text-lg mb-2">まだ履歴がありません</p>
          <p className="text-[#8494a7] text-sm">クレジットを購入すると、ここに履歴が表示されます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry, i) => (
            <div
              key={i}
              className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {entry.type === 'purchase' ? '🟢' : entry.type === 'refund' ? '🔵' : '🔴'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-[#f0f4f8] truncate">
                    {entry.description}
                  </p>
                  <p className="text-xs text-[#8494a7] mt-0.5">
                    {formatDate(entry.date)}
                    {entry.amount ? ` / ${formatAmount(entry.amount)}` : ''}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-bold flex-shrink-0 ${
                  entry.credits > 0
                    ? 'text-[#06C755]'
                    : 'text-[#f87171]'
                }`}
              >
                {entry.credits > 0 ? '+' : ''}{entry.credits.toLocaleString()}件
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
