'use client'

import { Suspense, useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const callbackUrl = searchParams.get('callbackUrl') || '/my-lists'
  const lineUserId = searchParams.get('lineUserId') || ''
  const resetSuccess = searchParams.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)

  const emailError = emailTouched && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'メールアドレスの形式が正しくありません'
    : ''

  // Redirect already-authenticated users to my-lists
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // メール認証チェック（signIn前に確認）
    try {
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (checkData.exists && !checkData.verified) {
          setLoading(false)
          setError('メールアドレスが認証されていません。登録時に送信された確認メールのリンクをクリックしてください。')
          return
        }
      }
    } catch {
      // チェック失敗時はsignInに進む
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setLoading(false)
      setError('メールアドレスまたはパスワードが正しくありません')
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
      setRedirecting(true)
      window.location.href = callbackUrl
    }
  }

  // Show spinner only when redirecting after successful login
  if (redirecting) {
    return (
      <div className="w-full max-w-md flex flex-col items-center justify-center py-20" role="status" aria-label="読み込み中">
        <svg className="animate-spin h-8 w-8 text-[#06C755] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-[#8fa3b8]">リダイレクト中...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-2">ログイン</h1>
        <p className="text-sm text-[#8fa3b8] mb-8">
          リスト管理・CSVダウンロードにはログインが必要です
        </p>

        {resetSuccess && (
          <div className="mb-6 bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] text-[#06C755] text-sm px-4 py-3 rounded-xl">
            パスワードを変更しました。新しいパスワードでログインしてください。
          </div>
        )}

        {error && (
          <div className="mb-6 bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-[#ff4757] text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-sm text-[#8fa3b8] mb-1.5">
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTouched(true)}
              required
              placeholder="example@email.com"
              className={`w-full bg-[#0a0f1c] border text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors placeholder:text-[#8494a7] ${
                emailError ? 'border-[rgba(255,71,87,0.5)] focus:border-[rgba(255,71,87,0.7)]' : 'border-[rgba(255,255,255,0.07)] focus:border-[rgba(6,199,85,0.4)]'
              }`}
            />
            {emailError && (
              <p className="text-[#ff4757] text-xs mt-1">{emailError}</p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm text-[#8fa3b8] mb-1.5">
              パスワード
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8494a7] hover:text-[#8fa3b8] transition-colors"
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
            className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-[#06C755] hover:text-[#04a344] transition-colors">
              パスワードを忘れた方はこちら
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-[#8494a7]">
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
      <Suspense fallback={<div className="text-[#8fa3b8]">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
