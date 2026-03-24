'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'

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
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setCreditsError('ネットワークに接続できません')
      } else {
        setCreditsError('クレジット情報の取得に失敗しました')
      }
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
        const message = data.error || (res.status === 401 ? 'ログインが必要です。再度ログインしてください。' : res.status >= 500 ? 'サーバーエラーが発生しました。しばらくお待ちください。' : '依頼の作成に失敗しました')
        setError(message)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        router.refresh()
      }, 1500)
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError('依頼の作成に失敗しました。しばらくお待ちください。')
      }
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
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError('決済ページの作成に失敗しました。しばらくお待ちください。')
      }
      setCheckoutLoading(null)
    }
  }

  const insufficientCredits = credits !== null && credits < targetCount

  const modalRef = useRef<HTMLDivElement>(null)
  // フォーカストラップはIME干渉のため無効化
  // const _unused = useFocusTrap(open, handleClose)

  return (
    <>
      <button
        onClick={handleOpen}
        className="bg-[#06C755] hover:bg-[#04a344] text-white font-bold px-5 py-2.5 rounded-full transition-all text-sm hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
      >
        + 新規依頼
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
          role="dialog"
          aria-modal="true"
          aria-label="新規リスト依頼"
        >
          <div ref={modalRef} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            {success ? (
              <div className="text-center py-8">
                <div className="text-[#06C755] text-4xl mb-3">&#10003;</div>
                <p className="text-[#f0f4f8] font-medium text-lg">依頼を受け付けました</p>
                <p className="text-[#8fa3b8] text-sm mt-1">リスト収集を開始します</p>
              </div>
            ) : view === 'plans' ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <button
                    onClick={() => { setView('form'); setError(null); }}
                    className="text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors"
                    aria-label="戻る"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <h2 className="text-lg font-bold text-[#f0f4f8]">クレジットを購入</h2>
                </div>
                <p className="text-sm text-[#8fa3b8] mb-5 ml-8">
                  プランを選択して購入してください
                </p>

                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading !== null}
                      className={`w-full text-left relative rounded-2xl border px-4 py-3.5 transition-all ${
                        plan.popular
                          ? 'border-[rgba(6,199,85,0.4)] bg-[rgba(6,199,85,0.05)] hover:bg-[rgba(6,199,85,0.1)]'
                          : 'border-[rgba(255,255,255,0.07)] bg-[#0a0f1c] hover:bg-[#152035]'
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
                            <span className="text-[#f0f4f8] font-bold text-lg">
                              &yen;{plan.price.toLocaleString()}
                            </span>
                            <span className="text-[#8fa3b8] text-sm">
                              / {plan.credits.toLocaleString()}件
                            </span>
                          </div>
                          <p className="text-[#8494a7] text-xs mt-0.5">
                            &yen;{plan.unitPrice}/件
                          </p>
                        </div>
                        <div className="text-[#8fa3b8]">
                          {checkoutLoading === plan.id ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" role="status" aria-label="読み込み中">
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
                  <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-2.5 mt-4">
                    <p className="text-[#ff4757] text-sm">{error}</p>
                  </div>
                )}

                <p className="text-[#8494a7] text-xs text-center mt-4">
                  Stripeの安全な決済ページに移動します
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">新規リスト依頼</h2>
                <p className="text-sm text-[#8fa3b8] mb-6">
                  業種・地域・件数を指定してリストを作成します
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#8fa3b8] mb-1.5">
                      業種 <span className="text-[#ff4757]">*</span>
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="例: 整体院、美容室、不動産会社"
                      required
                      className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 text-[#f0f4f8] text-sm placeholder:text-[#8494a7] focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8fa3b8] mb-1.5">
                      地域 <span className="text-[#ff4757]">*</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="例: 東京都、大阪市、福岡県"
                      required
                      className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 text-[#f0f4f8] text-sm placeholder:text-[#8494a7] focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8fa3b8] mb-1.5">
                      件数
                    </label>
                    <div className="relative">
                      <select
                        value={targetCount}
                        onChange={(e) => setTargetCount(Number(e.target.value))}
                        className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-2.5 pr-10 text-[#f0f4f8] text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors appearance-none cursor-pointer"
                      >
                        {COUNT_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}件
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8fa3b8]"
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  {/* クレジット表示 */}
                  <div className="bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#8fa3b8]">残りクレジット</span>
                      {credits !== null ? (
                        <span className={`font-medium ${insufficientCredits ? 'text-[#ff4757]' : 'text-[#f0f4f8]'}`}>
                          {credits}件
                        </span>
                      ) : creditsError ? (
                        <span className="text-[#ff4757] text-xs">{creditsError}</span>
                      ) : (
                        <span className="text-[#8494a7]">読み込み中...</span>
                      )}
                    </div>
                    {insufficientCredits && (
                      <p className="text-[#ff4757] text-xs mt-1.5">
                        クレジットが不足しています（必要: {targetCount}件）
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-2.5">
                      <p className="text-[#ff4757] text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={submitting}
                      className="flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(255,255,255,0.15)] font-medium py-2.5 rounded-full transition-colors text-sm disabled:opacity-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || insufficientCredits || !industry.trim() || !location.trim()}
                      className="flex-1 bg-[#06C755] hover:bg-[#04a344] disabled:bg-[#0d1526] disabled:text-[#8494a7] text-white font-bold py-2.5 rounded-full transition-all text-sm disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
                    >
                      {submitting ? '送信中...' : '依頼する'}
                    </button>
                  </div>

                  {insufficientCredits && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => { setView('plans'); setError(null); }}
                        className="inline-flex items-center gap-1 text-[#06C755] hover:text-[#04a344] text-sm font-medium transition-colors cursor-pointer"
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
