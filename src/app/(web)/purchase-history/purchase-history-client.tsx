'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Purchase {
  id: string
  amount: number
  credits: number
  stripeId: string | null
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SkeletonRow() {
  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl p-4 animate-pulse" role="status" aria-label="読み込み中">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-[#1e293b] rounded" />
          <div className="h-3 w-24 bg-[#1e293b] rounded" />
        </div>
        <div className="h-5 w-16 bg-[#1e293b] rounded-full" />
      </div>
    </div>
  )
}

export default function PurchaseHistoryClient() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPurchases() {
      try {
        const res = await fetch('/api/user/purchases')
        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          const message = errorData?.error || (res.status === 401 ? 'ログインが必要です。再度ログインしてください。' : res.status >= 500 ? 'サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。' : `購入履歴の取得に失敗しました (${res.status})`)
          setError(message)
          return
        }
        const data = await res.json()
        setPurchases(data.purchases)
      } catch (err) {
        if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
          setError('ネットワークに接続できません。インターネット接続を確認してください。')
        } else {
          setError('購入履歴の取得に失敗しました。しばらく時間をおいて再度お試しください。')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchPurchases()
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-10">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-lg sm:text-2xl font-bold text-[#f0f4f8] mb-1">購入履歴</h1>
        <p className="text-[#8fa3b8] text-xs sm:text-sm">
          クレジットの購入履歴を確認できます
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <p className="text-sm text-[#ff4757] mb-2">購入履歴の取得に失敗しました</p>
          <p className="text-xs text-[#8494a7] mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); window.location.reload() }}
            className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-4 py-2 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] cursor-pointer"
          >
            再試行
          </button>
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#06C755]">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <p className="text-[#f0f4f8] font-medium mb-2">購入履歴がありません</p>
          <p className="text-sm text-[#8494a7] mb-6">
            クレジットを購入すると、ここに履歴が表示されます
          </p>
          <Link
            href="/purchase"
            className="inline-block bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            クレジットを購入する
          </Link>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-4 mb-3 sm:mb-6">
            <div className="flex items-center justify-between">
              <span className="text-[#8fa3b8] text-xs sm:text-sm">合計購入回数</span>
              <span className="text-[#f0f4f8] font-bold text-base sm:text-xl">{purchases.length}回</span>
            </div>
          </div>

          {/* Purchase list */}
          <div className="space-y-3">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl sm:rounded-2xl p-3 sm:p-5 transition-all hover:border-[rgba(6,199,85,0.4)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[#f0f4f8] font-medium text-sm sm:text-base">
                      {purchase.credits.toLocaleString()}件 / &yen;{purchase.amount.toLocaleString()}
                    </div>
                    <div className="text-[#8494a7] text-xs sm:text-sm mt-0.5">
                      {formatDate(purchase.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-[#06C755] bg-[rgba(6,199,85,0.1)]">
                      完了
                    </span>
                  </div>
                </div>
                <p className="text-[#8494a7] text-[10px] sm:text-xs mt-2">
                  領収書はメールで送信されます
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="text-center mt-6 sm:mt-8">
        <Link
          href="/purchase"
          className="text-[#06C755] hover:text-[#04a344] text-xs sm:text-sm font-medium transition-colors"
        >
          クレジット購入ページへ戻る
        </Link>
      </div>
    </div>
  )
}
