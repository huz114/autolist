'use client'

import { useState, useEffect } from 'react'

const PLANS = [
  { id: 'plan_200', price: 1980, credits: 200, unitPrice: '9.9', popular: false },
  { id: 'plan_500', price: 3980, credits: 500, unitPrice: '8.0', popular: false },
  { id: 'plan_1000', price: 6980, credits: 1000, unitPrice: '7.0', popular: true },
  { id: 'plan_2000', price: 12800, credits: 2000, unitPrice: '6.4', popular: false },
]

export default function PurchasePage() {
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsError, setCreditsError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/user/credits')
        const data = await res.json()
        if (res.ok) {
          setCredits(data.credits)
        } else {
          setCreditsError(data.error || 'クレジット情報の取得に失敗しました')
        }
      } catch {
        setCreditsError('クレジット情報の取得に失敗しました')
      }
    }
    fetchCredits()
  }, [])

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || '決済ページの作成に失敗しました')
        setCheckoutLoading(null)
      }
    } catch {
      setError('決済ページの作成に失敗しました')
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-10">
      <h1 className="text-lg sm:text-2xl font-bold text-[#f0f4f8] mb-1 sm:mb-2">クレジット購入</h1>
      <p className="text-[#8fa3b8] text-xs sm:text-sm mb-3 sm:mb-8">
        プランを選択してクレジットを購入できます。
      </p>

      {/* Current credit balance */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-4 mb-3 sm:mb-8">
        <div className="flex items-center justify-between">
          <span className="text-[#8fa3b8] text-xs sm:text-sm">残りクレジット</span>
          {credits !== null ? (
            <span className="text-[#f0f4f8] font-bold text-base sm:text-xl">{credits.toLocaleString()}件</span>
          ) : creditsError ? (
            <span className="text-[#ff4757] text-xs sm:text-sm">{creditsError}</span>
          ) : (
            <span className="text-[#8494a7] text-xs sm:text-sm">読み込み中...</span>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-xl sm:rounded-2xl border p-3 sm:p-6 transition-all ${
              plan.popular
                ? 'border-[#06C755] bg-[#111827] shadow-[0_0_40px_rgba(6,199,85,0.2),0_0_0_1px_#06C755]'
                : 'border-[rgba(255,255,255,0.07)] bg-[#111827] hover:border-[rgba(6,199,85,0.4)]'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-[#06C755] text-white text-[9px] sm:text-[11px] font-extrabold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap tracking-wide">
                おすすめ
              </span>
            )}

            <div className="text-center mb-2 sm:mb-4 pt-0.5 sm:pt-1">
              <div className="text-[#8494a7] text-[11px] sm:text-sm mb-0.5 sm:mb-2">{plan.credits.toLocaleString()}件分</div>
              <div className="text-xl sm:text-3xl font-black text-[#f0f4f8]">
                &yen;{plan.price.toLocaleString()}
              </div>
              <div className="text-[#06C755] text-[11px] sm:text-sm font-bold mt-0.5 sm:mt-1">
                &yen;{plan.unitPrice} / 件
              </div>
            </div>

            <div className="h-px bg-[rgba(255,255,255,0.07)] my-2 sm:my-4" />

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={checkoutLoading !== null}
              className={`w-full py-1.5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all disabled:cursor-not-allowed ${
                plan.popular
                  ? 'bg-[#06C755] hover:bg-[#04a344] text-white hover:shadow-[0_0_20px_rgba(6,199,85,0.5)] disabled:opacity-50'
                  : 'bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] text-[#f0f4f8] disabled:opacity-50'
              }`}
            >
              {checkoutLoading === plan.id ? (
                <span className="inline-flex items-center gap-1 sm:gap-2">
                  <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24" role="status" aria-label="読み込み中">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  処理中...
                </span>
              ) : (
                '購入する'
              )}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-3 mt-4 sm:mt-6">
          <p className="text-[#ff4757] text-xs sm:text-sm">{error}</p>
        </div>
      )}

      <p className="text-[#8494a7] text-[10px] sm:text-xs text-center mt-4 sm:mt-8">
        Stripeの安全な決済ページに移動します
      </p>

      <div className="text-center mt-3 sm:mt-4">
        <a
          href="/purchase-history"
          className="text-[#06C755] hover:text-[#04a344] text-xs sm:text-sm font-medium transition-colors"
        >
          購入履歴を見る →
        </a>
      </div>
    </div>
  )
}
