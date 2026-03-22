'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

const COUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const PLANS = [
  { id: 'plan_100', price: 2000, credits: 100, unitPrice: '20' },
  { id: 'plan_300', price: 5000, credits: 300, unitPrice: '16.7' },
  { id: 'plan_700', price: 10000, credits: 700, unitPrice: '14.3', popular: true },
  { id: 'plan_1500', price: 15000, credits: 1500, unitPrice: '10' },
]

export default function NewRequestButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [targetCount, setTargetCount] = useState(30)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsError, setCreditsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [view, setView] = useState<'form' | 'plans'>('form')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    setCreditsError(null)
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
  }, [])

  useEffect(() => {
    if (open) {
      fetchCredits()
    }
  }, [open, fetchCredits])

  const handleOpen = () => {
    setOpen(true)
    setIndustry('')
    setLocation('')
    setTargetCount(30)
    setError(null)
    setSuccess(false)
    setView('form')
    setCheckoutLoading(null)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, location, targetCount }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '依頼の作成に失敗しました')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        router.refresh()
      }, 1500)
    } catch {
      setError('依頼の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId)
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

  const insufficientCredits = credits !== null && credits < targetCount

  return (
    <>
      <button
        onClick={handleOpen}
        className="bg-[#06C755] hover:bg-[#05b34a] text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
      >
        + 新規依頼
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div className="bg-[#16161f] border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            {success ? (
              <div className="text-center py-8">
                <div className="text-emerald-400 text-4xl mb-3">&#10003;</div>
                <p className="text-white font-medium text-lg">依頼を受け付けました</p>
                <p className="text-gray-400 text-sm mt-1">リスト収集を開始します</p>
              </div>
            ) : view === 'plans' ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <button
                    onClick={() => { setView('form'); setError(null); }}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="戻る"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <h2 className="text-lg font-bold text-white">クレジットを購入</h2>
                </div>
                <p className="text-sm text-gray-400 mb-5 ml-8">
                  プランを選択して購入してください
                </p>

                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading !== null}
                      className={`w-full text-left relative rounded-xl border px-4 py-3.5 transition-all ${
                        plan.popular
                          ? 'border-[#06C755]/50 bg-[#06C755]/5 hover:bg-[#06C755]/10'
                          : 'border-white/10 bg-[#0a0a0f] hover:bg-white/5'
                      } ${
                        checkoutLoading === plan.id ? 'opacity-70' : ''
                      } disabled:cursor-not-allowed`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2.5 right-3 bg-[#06C755] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          人気
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-white font-bold text-lg">
                              &yen;{plan.price.toLocaleString()}
                            </span>
                            <span className="text-gray-400 text-sm">
                              / {plan.credits.toLocaleString()}件
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">
                            &yen;{plan.unitPrice}/件
                          </p>
                        </div>
                        <div className="text-gray-400">
                          {checkoutLoading === plan.id ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                              <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-2.5 mt-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <p className="text-gray-600 text-xs text-center mt-4">
                  Stripeの安全な決済ページに移動します
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-white mb-1">新規リスト依頼</h2>
                <p className="text-sm text-gray-400 mb-6">
                  業種・地域・件数を指定してリストを作成します
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      業種 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="例: 整体院、美容室、不動産会社"
                      required
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#06C755]/50 focus:ring-1 focus:ring-[#06C755]/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      地域 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="例: 東京都、大阪市、福岡県"
                      required
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#06C755]/50 focus:ring-1 focus:ring-[#06C755]/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      件数
                    </label>
                    <select
                      value={targetCount}
                      onChange={(e) => setTargetCount(Number(e.target.value))}
                      className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#06C755]/50 focus:ring-1 focus:ring-[#06C755]/30 transition-colors appearance-none cursor-pointer"
                    >
                      {COUNT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}件
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* クレジット表示 */}
                  <div className="bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">残りクレジット</span>
                      {credits !== null ? (
                        <span className={`font-medium ${insufficientCredits ? 'text-red-400' : 'text-white'}`}>
                          {credits}件
                        </span>
                      ) : creditsError ? (
                        <span className="text-red-400 text-xs">{creditsError}</span>
                      ) : (
                        <span className="text-gray-500">読み込み中...</span>
                      )}
                    </div>
                    {insufficientCredits && (
                      <p className="text-red-400 text-xs mt-1.5">
                        クレジットが不足しています（必要: {targetCount}件）
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-2.5">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={submitting}
                      className="flex-1 bg-transparent border border-white/10 text-gray-300 hover:text-white hover:border-white/20 font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || insufficientCredits || !industry.trim() || !location.trim()}
                      className="flex-1 bg-[#06C755] hover:bg-[#05b34a] disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:cursor-not-allowed"
                    >
                      {submitting ? '送信中...' : '依頼する'}
                    </button>
                  </div>

                  {insufficientCredits && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => { setView('plans'); setError(null); }}
                        className="inline-flex items-center gap-1 text-[#06C755] hover:text-[#05b34a] text-sm font-medium transition-colors cursor-pointer"
                      >
                        クレジットを購入する &rarr;
                      </button>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
