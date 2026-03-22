'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, jobId: jobId || undefined }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || '登録に失敗しました')
      return
    }

    // メール認証が必要 → 確認メッセージを表示
    setRegistered(true)
  }

  // 登録完了 → メール確認メッセージ
  if (registered) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[#06C755]/10 border border-[#06C755]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-bold text-white text-center mb-3">確認メールを送信しました</h1>
          <p className="text-sm text-gray-400 text-center mb-2">
            <span className="text-[#06C755] font-medium">{email}</span> に確認メールを送信しました。
          </p>
          <p className="text-sm text-gray-400 text-center mb-6">
            メール内のリンクをクリックして、アカウントを有効化してください。
          </p>
          <Link href="/login" className="block w-full bg-[#06C755] hover:bg-[#05b34a] text-white font-medium py-2.5 rounded-lg transition-colors text-center">
            ログインページへ
          </Link>
          <p className="mt-4 text-center text-xs text-gray-500">
            メールが届かない場合は、迷惑メールフォルダをご確認ください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">アカウント登録</h1>
        <p className="text-sm text-gray-400 mb-8">
          登録後、リスト確認・フォーム送信が利用可能になります
        </p>

        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {jobId && (
            <input type="hidden" name="jobId" value={jobId} />
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              お名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              メールアドレス <span className="text-[#06C755]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              パスワード <span className="text-[#06C755]">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="8文字以上"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#06C755] hover:bg-[#05b34a] disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? '登録中...' : '無料で登録する'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          既にアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-[#06C755] hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-gray-400">読み込み中...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
