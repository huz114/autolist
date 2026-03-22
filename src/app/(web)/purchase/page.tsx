'use client'

import { useState, useEffect } from 'react'

const PLANS = [
  { id: 'plan_100', price: 2000, credits: 100, unitPrice: '20', popular: false },
  { id: 'plan_300', price: 5000, credits: 300, unitPrice: '16.7', popular: false },
  { id: 'plan_700', price: 10000, credits: 700, unitPrice: '14.3', popular: true },
  { id: 'plan_1500', price: 15000, credits: 1500, unitPrice: '10', popular: false },
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
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-2">クレジット購入</h1>
      <p className="text-gray-400 text-sm mb-8">
        プランを選択してクレジットを購入してください。購入したクレジットでリスト収集を依頼できます。
      </p>

      {/* Current credit balance */}
      <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 mb-8">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">現在の残りクレジット</span>
          {credits !== null ? (
            <span className="text-white font-bold text-xl">{credits.toLocaleString()}件</span>
          ) : creditsError ? (
            <span className="text-red-400 text-sm">{creditsError}</span>
          ) : (
            <span className="text-gray-500 text-sm">読み込み中...</span>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 transition-all ${
              plan.popular
                ? 'border-[#06C755]/30 bg-[#16161f]'
                : 'border-white/10 bg-[#16161f]'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#06C755]/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                人気
              </span>
            )}

            <div className="text-center mb-4 pt-1">
              <div className="text-3xl font-bold text-white">
                &yen;{plan.price.toLocaleString()}
              </div>
              <div className="text-gray-400 text-sm mt-1">
                {plan.credits.toLocaleString()}件分
              </div>
            </div>

            <div className="text-center text-gray-500 text-xs mb-5">
              1件あたり &yen;{plan.unitPrice}
            </div>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={checkoutLoading !== null}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 text-white disabled:opacity-50"
            >
              {checkoutLoading === plan.id ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-3 mt-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <p className="text-gray-600 text-xs text-center mt-8">
        Stripeの安全な決済ページに移動します
      </p>
    </div>
  )
}
