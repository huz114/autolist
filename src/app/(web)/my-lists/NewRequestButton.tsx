'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'

const PLANS = [
  { id: 'plan_300', price: 2980, credits: 300, unitPrice: '9.9' },
  { id: 'plan_600', price: 4980, credits: 600, unitPrice: '8.3' },
  { id: 'plan_1200', price: 8980, credits: 1200, unitPrice: '7.5', popular: true },
  { id: 'plan_3000', price: 19200, credits: 3000, unitPrice: '6.4' },
]

interface AnalyzeResult {
  industry: string
  location: string
  targetCount: number
  industryKeywords: string[]
  searchQueries: string[]
  excludeTerms: string[]
  isDomestic: boolean
  industrySpecified: boolean
  locationSpecified: boolean
  countSpecified: boolean
  ambiguousLocation: string | null
}

type Phase = 'input' | 'analyzing' | 'confirmation' | 'submitting' | 'success'

export default function NewRequestButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('input')
  const [inputText, setInputText] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsError, setCreditsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'chat' | 'plans'>('chat')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

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

  // Focus input when phase changes to input (but not on initial mount to avoid IME issues)
  const hasOpenedRef = useRef(false)
  useEffect(() => {
    if (open && phase === 'input' && view === 'chat') {
      // Small delay to avoid focus issues with modal animation
      const timer = setTimeout(() => {
        if (hasOpenedRef.current) {
          inputRef.current?.focus()
        }
        hasOpenedRef.current = true
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open, phase, view])

  const handleOpen = () => {
    setOpen(true)
    setPhase('input')
    setInputText('')
    setAnalyzeResult(null)
    setError(null)
    setView('chat')
    setCheckoutLoading(null)
    hasOpenedRef.current = false
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleAnalyze = async () => {
    if (!inputText.trim()) return

    // 件数チェック（AI呼び出し前にクライアント側で弾く）
    if (!/[\d０-９]+/.test(inputText)) {
      setError('件数を含めてください。\n例: 「渋谷区の不動産会社 30件」')
      return
    }

    setError(null)
    setPhase('analyzing')

    try {
      const res = await fetch('/api/jobs/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '解析に失敗しました')
        setPhase('input')
        return
      }

      const result = data as AnalyzeResult

      // Check if all fields are missing (unrelated message)
      const missingFields = []
      if (!result.industrySpecified) missingFields.push('industry')
      if (!result.locationSpecified) missingFields.push('location')
      if (!result.countSpecified) missingFields.push('count')

      if (missingFields.length === 3) {
        setError('業種・地域・件数を含めて入力してください。\n例: 「渋谷区の不動産会社 30件」')
        setPhase('input')
        return
      }

      if (missingFields.length > 0) {
        const missingLabels = []
        if (!result.industrySpecified) missingLabels.push('業種')
        if (!result.locationSpecified) missingLabels.push('地域')
        if (!result.countSpecified) missingLabels.push('件数')
        setError(`${missingLabels.join('・')}が指定されていません。まとめて入力してください。\n例: 「渋谷区の不動産会社 30件」`)
        setPhase('input')
        return
      }

      // Validate targetCount
      if (result.targetCount < 10) {
        setError('10件以上からご利用いただけます。10件単位でご指定ください。')
        setPhase('input')
        return
      }
      if (result.targetCount % 10 !== 0) {
        setError('件数は10件単位でご指定ください。（例: 10、20、30、50件）')
        setPhase('input')
        return
      }
      if (result.targetCount > 100) {
        setError('一度に依頼できるのは最大100件までです。件数を減らして再度ご入力ください。')
        setPhase('input')
        return
      }

      setAnalyzeResult(result)
      setPhase('confirmation')
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError('解析に失敗しました。しばらくお待ちください。')
      }
      setPhase('input')
    }
  }

  const handleSubmit = async () => {
    if (!analyzeResult) return

    setError(null)
    setPhase('submitting')

    try {
      const res = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: analyzeResult.industry,
          location: analyzeResult.location,
          targetCount: analyzeResult.targetCount,
          industryKeywords: analyzeResult.industryKeywords,
          searchQueries: analyzeResult.searchQueries,
          excludeTerms: analyzeResult.excludeTerms,
          originalMessage: inputText.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const message = data.error || (
          res.status === 401 ? 'ログインが必要です。再度ログインしてください。' :
          res.status >= 500 ? 'サーバーエラーが発生しました。しばらくお待ちください。' :
          '依頼の作成に失敗しました'
        )
        setError(message)
        setPhase('confirmation')
        return
      }

      setPhase('success')
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError('依頼の作成に失敗しました。しばらくお待ちください。')
      }
      setPhase('confirmation')
    }
  }

  const handleBack = (message?: string) => {
    setError(message || null)
    setPhase('input')
    // Keep inputText so user can modify
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAnalyze()
    }
  }

  const insufficientCredits = analyzeResult && credits !== null && credits < analyzeResult.targetCount

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
            // 背景クリックではモーダルを閉じない（×ボタンのみ）
          }}
          role="dialog"
          aria-modal="true"
          aria-label="新規リスト依頼"
        >
          <div ref={modalRef} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            {view === 'plans' ? (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-1">
                  <button
                    onClick={() => { setView('chat'); setError(null); }}
                    className="text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
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
                      className={`w-full text-left relative rounded-2xl border px-4 py-3.5 transition-all cursor-pointer ${
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
              </div>
            ) : phase === 'success' ? (
              <div className="p-6">
                <div className="text-center py-8">
                  <div className="text-[#06C755] text-4xl mb-3">&#10003;</div>
                  <p className="text-[#f0f4f8] font-medium text-lg">依頼を受け付けました</p>
                  <p className="text-[#8fa3b8] text-sm mt-1">リスト収集を開始します</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header - compact for non-input phases, hidden for input phase */}
                {phase !== 'input' && (
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-[#f0f4f8]">新規リスト依頼</h2>
                      <button
                        onClick={handleClose}
                        className="text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
                        aria-label="閉じる"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat area */}
                <div className={phase === 'input' ? '' : 'px-6 pb-4 min-h-[200px]'}>
                  {phase === 'analyzing' && (
                    <div className="py-6">
                      <div className="flex justify-end mb-4">
                        <div className="bg-[#06C755] text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                          {inputText}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-5 w-5 text-[#06C755] flex-shrink-0" viewBox="0 0 24 24" role="status" aria-label="解析中">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-[#8fa3b8] text-sm">AIが解析中...</p>
                      </div>
                    </div>
                  )}

                  {phase === 'submitting' && (
                    <div className="py-6">
                      <div className="flex justify-end mb-4">
                        <div className="bg-[#06C755] text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                          {inputText}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <svg className="animate-spin h-5 w-5 text-[#06C755] flex-shrink-0" viewBox="0 0 24 24" role="status" aria-label="送信中">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-[#8fa3b8] text-sm">依頼を送信中...</p>
                      </div>
                    </div>
                  )}

                  {phase === 'input' && (
                    <div className="relative px-6 pt-5 pb-7">
                      {/* Close button - top right, subtle */}
                      <div className="flex justify-end animate-fade-in-up">
                        <button
                          onClick={handleClose}
                          className="text-[#444c5a] hover:text-[#8fa3b8] transition-colors cursor-pointer p-1 rounded-lg hover:bg-[rgba(255,255,255,0.04)]"
                          aria-label="閉じる"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Hero heading with shimmer gradient */}
                      <div className="text-center mt-2 mb-7 animate-fade-in-up-delay-1">
                        <h2 className="text-2xl font-extrabold tracking-tight heading-shimmer leading-tight">
                          何を探しますか？
                        </h2>
                        <p className="text-[#555f6d] text-[13px] mt-2 tracking-wide font-medium">
                          業種・地域・件数をまとめて入力
                        </p>
                      </div>

                      {/* THE INPUT - Hero element, unmistakable */}
                      <div className="animate-fade-in-up-delay-2">
                        <div className="relative flex items-center bg-[#080c16] border-2 border-[rgba(255,255,255,0.08)] rounded-2xl pl-5 pr-2 py-1 focus-within:border-[rgba(6,199,85,0.5)] focus-within:shadow-[0_0_20px_rgba(6,199,85,0.15)] transition-all duration-300 animate-glow-pulse">
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="渋谷区の不動産会社 30件"
                            className="flex-1 bg-transparent text-[#f0f4f8] text-base py-3.5 placeholder:text-[#3d4654] placeholder:font-medium focus:outline-none"
                          />
                          <button
                            onClick={handleAnalyze}
                            disabled={!inputText.trim()}
                            className="flex-shrink-0 ml-2 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-not-allowed bg-[#06C755] hover:bg-[#04a344] disabled:bg-[#141c2b] hover:shadow-[0_0_20px_rgba(6,199,85,0.4)] hover:scale-105 active:scale-95"
                            aria-label="送信"
                          >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M3.5 9H14.5M14.5 9L10 4.5M14.5 9L10 13.5" stroke={inputText.trim() ? 'white' : '#555f6d'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Error message - between input and examples */}
                      {error && (
                        <div className="bg-[rgba(255,71,87,0.08)] border border-[rgba(255,71,87,0.25)] rounded-xl px-4 py-3 mt-4">
                          <p className="text-[#ff6b78] text-sm whitespace-pre-line leading-relaxed">{error}</p>
                        </div>
                      )}

                      {/* Example chips - below the input */}
                      <div className="flex flex-wrap justify-center gap-2 mt-5 animate-fade-in-up-delay-3">
                        {[
                          { label: '渋谷区 不動産 30件', value: '渋谷区の不動産会社 30件' },
                          { label: '大阪市 美容サロン 30件', value: '大阪市の美容サロン 30件' },
                          { label: '福岡 整体院 20件', value: '福岡県の整体院 20件' },
                        ].map((example) => (
                          <button
                            key={example.value}
                            onClick={() => setInputText(example.value)}
                            className="text-[11px] text-[#555f6d] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-full px-3.5 py-1.5 hover:border-[rgba(6,199,85,0.35)] hover:text-[#06C755] hover:bg-[rgba(6,199,85,0.04)] transition-all duration-200 cursor-pointer font-medium tracking-wide"
                          >
                            {example.label}
                          </button>
                        ))}
                      </div>

                      {/* Credits - bottom, very subtle */}
                      <div className="flex items-center justify-center gap-3 mt-6 text-[11px] text-[#3d4654] animate-fade-in-up-delay-4">
                        <span>
                          残り{' '}
                          {credits !== null ? (
                            <span className={credits <= 0 ? 'text-[#ff6b78]' : 'text-[#555f6d]'}>
                              {credits}件
                            </span>
                          ) : creditsError ? (
                            <span className="text-[#ff6b78]">{creditsError}</span>
                          ) : (
                            <span>...</span>
                          )}
                        </span>
                        {credits !== null && credits <= 0 && (
                          <>
                            <span className="text-[#2a3040]">&middot;</span>
                            <button
                              onClick={() => { setView('plans'); setError(null); }}
                              className="text-[#06C755] hover:text-[#04a344] font-medium transition-colors cursor-pointer"
                            >
                              購入する
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {phase === 'confirmation' && analyzeResult && (
                    <div className="py-2">
                      {/* User's message bubble */}
                      <div className="flex justify-end mb-4">
                        <div className="bg-[#06C755] text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                          {inputText}
                        </div>
                      </div>

                      {/* Ambiguous location warning */}
                      {analyzeResult.ambiguousLocation && (
                        <div className="bg-[rgba(255,193,7,0.1)] border border-[rgba(255,193,7,0.3)] rounded-xl px-4 py-3 mb-4">
                          <p className="text-[#ffc107] text-sm">
                            「{analyzeResult.ambiguousLocation}」は複数の都道府県に存在します。都道府県を含めて入力してください。
                          </p>
                          <button
                            onClick={() => handleBack(`「${analyzeResult.ambiguousLocation}」は複数の都道府県に存在します。\n例: 「東京都${analyzeResult.ambiguousLocation}」のように都道府県を含めてください。`)}
                            className="mt-2 text-[#06C755] hover:text-[#04a344] text-sm font-medium transition-colors cursor-pointer"
                          >
                            修正する
                          </button>
                        </div>
                      )}

                      {/* Overseas rejection */}
                      {!analyzeResult.isDomestic && (
                        <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-3 mb-4">
                          <p className="text-[#ff4757] text-sm">
                            現在は日本国内の地域のみ対応しています。
                          </p>
                          <button
                            onClick={() => handleBack('現在は日本国内の地域のみ対応しています。地域を変更してください。')}
                            className="mt-2 text-[#06C755] hover:text-[#04a344] text-sm font-medium transition-colors cursor-pointer"
                          >
                            修正する
                          </button>
                        </div>
                      )}

                      {/* Parsed result card (only show if no blocking errors) */}
                      {!analyzeResult.ambiguousLocation && analyzeResult.isDomestic && (
                        <>
                          <div className="bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl px-4 py-4 mb-4">
                            <p className="text-[#8fa3b8] text-xs font-medium mb-3">以下の条件でリストを収集します</p>
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[#8fa3b8] text-sm">🏢 業種</span>
                                <span className="text-[#f0f4f8] text-sm font-medium">{analyzeResult.industry}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8fa3b8] text-sm">📍 地域</span>
                                <span className="text-[#f0f4f8] text-sm font-medium">{analyzeResult.location}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[#8fa3b8] text-sm">📊 件数</span>
                                <span className="text-[#f0f4f8] text-sm font-medium">{analyzeResult.targetCount}社</span>
                              </div>
                              <div className="border-t border-[rgba(255,255,255,0.07)] pt-2.5 mt-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#8fa3b8] text-sm">💳 消費クレジット</span>
                                  <span className="text-[#06C755] text-sm font-bold">最大{analyzeResult.targetCount}</span>
                                </div>
                                {credits !== null && (
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[#8494a7] text-xs">残りクレジット</span>
                                    <span className="text-[#8494a7] text-xs">
                                      {credits}件 → 依頼後: <span className={credits - analyzeResult.targetCount < 0 ? 'text-[#ff6b78]' : 'text-[#f0f4f8]'}>{credits - analyzeResult.targetCount}件</span>
                                    </span>
                                  </div>
                                )}
                                <p className="text-[#8494a7] text-xs mt-1.5">開始時に仮押さえ、未使用分は返却されます</p>
                              </div>
                            </div>
                          </div>

                          {/* Insufficient credits */}
                          {insufficientCredits && (
                            <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-3 mb-4">
                              <p className="text-[#ff4757] text-sm">
                                クレジットが不足しています（残り: {credits}件 / 必要: {analyzeResult.targetCount}件）
                              </p>
                              <button
                                onClick={() => { setView('plans'); setError(null); }}
                                className="mt-2 inline-flex items-center gap-1 text-[#06C755] hover:text-[#04a344] text-sm font-medium transition-colors cursor-pointer"
                              >
                                クレジットを購入する &rarr;
                              </button>
                            </div>
                          )}

                          {error && (
                            <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-2.5 mb-4">
                              <p className="text-[#ff4757] text-sm">{error}</p>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => handleBack()}
                              className="flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(255,255,255,0.15)] font-medium py-2.5 rounded-full transition-colors text-sm cursor-pointer"
                            >
                              修正する
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={!!insufficientCredits}
                              className="flex-1 bg-[#06C755] hover:bg-[#04a344] disabled:bg-[#0d1526] disabled:text-[#8494a7] text-white font-bold py-2.5 rounded-full transition-all text-sm disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] cursor-pointer"
                            >
                              依頼する
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
