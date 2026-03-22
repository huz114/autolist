'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/my-lists'
  const lineUserId = searchParams.get('lineUserId') || ''
  const resetSuccess = searchParams.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      // auth.ts の authorize で throw されたエラーメッセージを表示
      if (result.error.includes('メールアドレスが認証されていません')) {
        setError('メールアドレスが認証されていません。確認メールをご確認ください。')
      } else {
        setError('メールアドレスまたはパスワードが正しくありません')
      }
    } else {
      // LINEユーザーとWebアカウントの自動紐づけ
      if (lineUserId) {
        try {
          await fetch('/api/auth/link-line', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineUserId }),
          })
        } catch {
          // 紐づけ失敗はサイレント（メイン機能は継続）
        }
      }
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">ログイン</h1>
        <p className="text-sm text-gray-400 mb-8">
          リスト管理・フォーム送信はログインが必要です
        </p>

        {resetSuccess && (
          <div className="mb-6 bg-green-900/30 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg">
            パスワードを変更しました。新しいパスワードでログインしてください。
          </div>
        )}

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
              className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
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
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-[#06C755] hover:text-[#05b34a]">
              パスワードを忘れた方はこちら
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          アカウントをお持ちでない方は{' '}
          <Link
            href={lineUserId ? `/register?lineUserId=${lineUserId}` : '/register'}
            className="text-[#06C755] hover:underline"
          >
            アカウント登録
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-gray-400">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
