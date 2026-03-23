'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const email = searchParams.get('email')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendEmail, setResendEmail] = useState(email || '')

  const handleResend = async () => {
    if (!resendEmail) return
    setResendLoading(true)
    setResendMessage('')

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResendMessage(data.error || '再送信に失敗しました')
      } else {
        setResendMessage('確認メールを再送信しました。メールをご確認ください。')
      }
    } catch {
      setResendMessage('再送信に失敗しました')
    } finally {
      setResendLoading(false)
    }
  }

  // Determine display state: success / failed / default
  const isSuccess = status === 'success'
  const isFailed = status === 'invalid' || status === 'expired' || status === 'error'
  const failureMessage = status === 'expired'
    ? 'この確認リンクの有効期限が切れています。下のボタンから確認メールを再送信してください。'
    : status === 'invalid'
      ? 'この確認リンクは無効です。既に使用済みか、リンクが正しくない可能性があります。'
      : 'メール認証処理中にエラーが発生しました。もう一度お試しください。'

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
        {/* 認証成功 */}
        {isSuccess && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-[#f0f4f8] text-center mb-3">メール認証完了</h1>
            <p className="text-sm text-[#8fa3b8] text-center mb-6">
              メールアドレスが確認されました。ログインしてご利用ください。
            </p>
            <Link href="/login" className="block w-full bg-[#06C755] hover:bg-[#04a344] text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] text-center">
              ログインページへ
            </Link>
          </>
        )}

        {/* 認証失敗（無効・期限切れ・エラー統合） */}
        {isFailed && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#ff4757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-[#f0f4f8] text-center mb-3">
              {status === 'expired' ? 'リンクの有効期限切れ' : '認証に失敗しました'}
            </h1>
            <p className="text-sm text-[#8fa3b8] text-center mb-6">
              {failureMessage}
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="resendEmail" className="block text-sm text-[#8fa3b8] mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]"
                  placeholder="example@email.com"
                />
              </div>
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
              >
                {resendLoading ? '送信中...' : '確認メールを再送信'}
              </button>
            </div>
          </>
        )}

        {/* デフォルト（直接アクセス） */}
        {!isSuccess && !isFailed && (
          <>
            <h1 className="text-lg font-bold text-[#f0f4f8] text-center mb-3">メール認証</h1>
            <p className="text-sm text-[#8fa3b8] text-center mb-6">
              確認メールに記載されたリンクをクリックしてください。
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="resendEmail" className="block text-sm text-[#8fa3b8] mb-1.5">
                  確認メールを再送信
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]"
                  placeholder="example@email.com"
                />
              </div>
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
              >
                {resendLoading ? '送信中...' : '確認メールを再送信'}
              </button>
            </div>
          </>
        )}

        {/* 再送信メッセージ */}
        {resendMessage && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${
            resendMessage.includes('失敗') || resendMessage.includes('秒後')
              ? 'bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-[#ff4757]'
              : 'bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] text-[#06C755]'
          }`}>
            {resendMessage}
          </div>
        )}

        {/* ログインリンク */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[#06C755] hover:text-[#04a344] transition-colors">
            ログインページへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-[#8fa3b8]">読み込み中...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
