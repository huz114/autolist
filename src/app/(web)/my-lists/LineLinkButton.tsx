'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusTrap } from '@/lib/useFocusTrap'

const LINE_BOT_FRIEND_URL = 'https://line.me/R/ti/p/@285tdinf'

export default function LineLinkButton() {
  const [status, setStatus] = useState<{
    linked: boolean
    displayName?: string
    lineUserId?: string
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 連携ステータスを取得
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/link-line/status')
      const data = await res.json()
      if (res.ok) {
        setStatus(data)
        // 連携完了していたらモーダルを閉じる
        if (data.linked && open) {
          setOpen(false)
        }
      }
    } catch {
      // ignore
    }
  }, [open])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // カウントダウンタイマー
  useEffect(() => {
    if (!expiresAt) return

    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setRemaining(diff)
      if (diff <= 0 && timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    updateRemaining()
    timerRef.current = setInterval(updateRemaining, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [expiresAt])

  // ポーリングで連携完了を検知
  useEffect(() => {
    if (open && code && remaining > 0) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/auth/link-line/status')
          const data = await res.json()
          if (res.ok && data.linked) {
            setStatus(data)
            setOpen(false)
          }
        } catch {
          // ignore
        }
      }, 3000)

      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [open, code, remaining])

  const generateCode = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/link-line/generate-code', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setCode(data.code)
        setExpiresAt(new Date(data.expiresAt))
      } else {
        setError(data.error || 'コードの生成に失敗しました')
      }
    } catch {
      setError('コードの生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpen = async () => {
    setOpen(true)
    setError(null)
    await generateCode()
  }

  const handleClose = () => {
    setOpen(false)
    setCode(null)
    setExpiresAt(null)
    setRemaining(0)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const expired = expiresAt !== null && remaining <= 0

  const qrUrl = '/line-qr.png'

  const focusTrapRef = useFocusTrap(open, handleClose)

  const [copied, setCopied] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const handleUnlink = async () => {
    if (!confirm('LINE連携を解除しますか？LINEからの依頼ができなくなります。')) {
      return
    }
    setUnlinking(true)
    try {
      const res = await fetch('/api/auth/link-line/unlink', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus({ linked: false })
      } else {
        alert(data.error || 'LINE連携の解除に失敗しました')
      }
    } catch {
      alert('LINE連携の解除に失敗しました')
    } finally {
      setUnlinking(false)
    }
  }

  // 連携済み表示
  if (status?.linked) {
    return (
      <div className="inline-flex items-center gap-3">
        <div className="inline-flex items-center gap-2 bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.3)] rounded-full px-4 py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm text-[#06C755] font-medium">LINE連携済み</span>
          {status.displayName && (
            <span className="text-sm text-[#8fa3b8]">{status.displayName}</span>
          )}
        </div>
        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="text-xs text-[#8494a7] hover:text-[#ff4757] underline-offset-2 hover:underline transition-colors cursor-pointer disabled:opacity-50"
        >
          {unlinking ? '解除中...' : '解除'}
        </button>
      </div>
    )
  }

  // ローディング中（スケルトン表示）
  if (status === null) {
    return (
      <div
        className="inline-flex items-center w-[120px] h-[40px] rounded-full bg-[rgba(255,255,255,0.07)] animate-pulse"
        aria-label="読み込み中"
      />
    )
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#04a344] text-white font-bold px-5 py-2.5 rounded-full transition-all text-sm hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        LINE連携
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
          role="dialog"
          aria-modal="true"
          aria-label="LINE連携"
        >
          <div ref={focusTrapRef} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#f0f4f8]">LINE連携</h2>
              <button
                onClick={handleClose}
                className="text-[#8494a7] hover:text-[#8fa3b8] transition-colors cursor-pointer"
                aria-label="閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-[#8fa3b8] mb-5">
              LINEと連携すると、外出先からもリスト依頼や完了通知の受信ができます
            </p>

            {error && (
              <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-2.5 mb-4">
                <p className="text-[#ff4757] text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8" role="status" aria-label="読み込み中">
                <svg className="animate-spin h-8 w-8 text-[#06C755]" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : code && !expired ? (
              <div className="space-y-5">
                {/* Step 1: 友だち追加 */}
                <div className="bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                  <p className="text-sm font-medium text-[#f0f4f8] mb-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#06C755] text-white text-xs font-bold mr-2">1</span>
                    オートリストBotを友だち追加
                  </p>
                  <div className="flex justify-center">
                    <div className="bg-white rounded-lg p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrUrl}
                        alt="LINE友だち追加QRコード"
                        width={160}
                        height={160}
                        className="block"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2: LINEで連携コード送信 */}
                <div className="bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                  <p className="text-sm font-medium text-[#f0f4f8] mb-3">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#06C755] text-white text-xs font-bold mr-2">2</span>
                    以下をLINEのトークで送信
                  </p>
                  <div className="bg-[#111827] border border-[rgba(6,199,85,0.3)] rounded-xl p-5 text-center">
                    <p className="text-xs text-[#8fa3b8] mb-2">LINEのトークで以下の6桁コードを送信</p>
                    <p className="text-3xl font-mono font-bold tracking-[0.5em] text-[#f0f4f8]">
                      {code}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8fa3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-sm text-[#8fa3b8]">
                      有効期限: <span className="text-[#f0f4f8] font-medium">{formatTime(remaining)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : expired ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="text-[#f0f4f8] font-medium mb-1">コードの有効期限が切れました</p>
                <p className="text-sm text-[#8fa3b8] mb-4">新しいコードを発行してください</p>
                <button
                  onClick={generateCode}
                  disabled={loading}
                  className="bg-[#06C755] hover:bg-[#04a344] text-white font-bold px-6 py-2.5 rounded-full transition-all text-sm hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? '生成中...' : '再発行'}
                </button>
              </div>
            ) : null}

            <div className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.07)]">
              <button
                onClick={handleClose}
                className="w-full bg-transparent border border-[rgba(255,255,255,0.07)] text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(255,255,255,0.15)] font-medium py-2.5 rounded-full transition-colors text-sm cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
