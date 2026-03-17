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

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
        {/* 認証成功 */}
        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-white text-center mb-3">メール認証完了</h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              メールアドレスが確認されました。ログインしてご利用ください。
            </p>
            <Link href="/login" className="block w-full bg-orange-500 hover:bg-orange-400 text-white font-medium py-2.5 rounded-lg transition-colors text-center">
              ログインページへ
            </Link>
          </>
        )}

        {/* トークン無効 */}
        {status === 'invalid' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-white text-center mb-3">無効なリンク</h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              この確認リンクは無効です。既に使用済みか、リンクが正しくない可能性があります。
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="resendEmail" className="block text-sm text-gray-400 mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                  placeholder="example@email.com"
                />
              </div>
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {resendLoading ? '送信中...' : '確認メールを再送信'}
              </button>
            </div>
          </>
        )}

        {/* トークン期限切れ */}
        {status === 'expired' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-white text-center mb-3">リンクの有効期限切れ</h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              この確認リンクの有効期限が切れています。下のボタンから確認メールを再送信してください。
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="resendEmail" className="block text-sm text-gray-400 mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                  placeholder="example@email.com"
                />
              </div>
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {resendLoading ? '送信中...' : '確認メールを再送信'}
              </button>
            </div>
          </>
        )}

        {/* エラー */}
        {status === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-bold text-white text-center mb-3">エラーが発生しました</h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              メール認証処理中にエラーが発生しました。もう一度お試しください。
            </p>
            <Link href="/login" className="block w-full bg-orange-500 hover:bg-orange-400 text-white font-medium py-2.5 rounded-lg transition-colors text-center">
              ログインページへ
            </Link>
          </>
        )}

        {/* ステータスなし（直接アクセス） */}
        {!status && (
          <>
            <h1 className="text-lg font-bold text-white text-center mb-3">メール認証</h1>
            <p className="text-sm text-gray-400 text-center mb-6">
              確認メールに記載されたリンクをクリックしてください。
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="resendEmail" className="block text-sm text-gray-400 mb-1.5">
                  確認メールを再送信
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                  placeholder="example@email.com"
                />
              </div>
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {resendLoading ? '送信中...' : '確認メールを再送信'}
              </button>
            </div>
          </>
        )}

        {/* 再送信メッセージ */}
        {resendMessage && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            resendMessage.includes('失敗') || resendMessage.includes('秒後')
              ? 'bg-red-900/30 border border-red-500/30 text-red-400'
              : 'bg-green-900/30 border border-green-500/30 text-green-400'
          }`}>
            {resendMessage}
          </div>
        )}

        {/* ログインリンク */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-orange-400 hover:text-orange-300">
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
      <Suspense fallback={<div className="text-gray-400">読み込み中...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
