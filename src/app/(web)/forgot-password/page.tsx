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
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">パスワードをお忘れの方</h1>
          <p className="text-sm text-gray-400 mb-8">
            登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>

          {sent ? (
            <div className="bg-green-900/30 border border-green-500/30 text-green-400 text-sm px-4 py-4 rounded-lg text-center">
              <p className="font-medium mb-1">メールを送信しました</p>
              <p className="text-green-500/80">ご登録のメールアドレスをご確認ください。</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="example@email.com"
                    className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {loading ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="text-orange-400 hover:text-orange-300">
              ログインに戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
