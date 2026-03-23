'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || '送信に失敗しました。しばらくしてから再試行してください。')
      } else {
        setSent(true)
      }
    } catch {
      setError('送信に失敗しました。しばらくしてから再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#f0f4f8] mb-2">パスワードをお忘れの方</h1>
          <p className="text-sm text-[#8fa3b8] mb-8">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>

          {sent ? (
            <div className="bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] text-[#06C755] text-sm px-4 py-4 rounded-lg text-center">
              <p className="font-medium mb-1">メールを送信しました</p>
              <p className="text-[#06C755]">ご登録のメールアドレスをご確認ください。</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-[#ff4757] text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-[#8fa3b8] mb-1.5">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@email.com"
                    className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#4a6080]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-[#f0f4f8] font-bold py-2.5 rounded-full transition-colors"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-[#4a6080]">
            <Link href="/login" className="text-[#06C755] hover:text-[#05b34a]">
              ログインに戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
