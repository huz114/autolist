'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  const passwordStrength = password.length === 0
    ? null
    : password.length < 8
      ? { label: '弱い', color: '#ff4757', width: '33%' }
      : password.length < 12
        ? { label: '普通', color: '#ffa502', width: '66%' }
        : { label: '強い', color: '#06C755', width: '100%' }
  const passwordError = passwordTouched && password && password.length < 8
    ? '8文字以上で入力してください'
    : ''
  const confirmError = confirmTouched && confirmPassword && password !== confirmPassword
    ? 'パスワードが一致しません'
    : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordTouched(true)
    setConfirmTouched(true)
    setError('')

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error?.includes('無効') || data.error?.includes('invalid')) {
          setError('このリンクは無効です。パスワードリセットを再度お試しください。')
        } else if (data.error?.includes('期限') || data.error?.includes('expired')) {
          setError('このリンクは期限切れです。パスワードリセットを再度お試しください。')
        } else {
          setError(data.error || 'パスワードの変更に失敗しました')
        }
      } else {
        router.push('/login?reset=success')
      }
    } catch {
      setError('パスワードの変更に失敗しました。しばらくしてから再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#ff4757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-bold text-[#f0f4f8] text-center mb-3">無効なリンク</h1>
          <p className="text-sm text-[#8fa3b8] text-center mb-6">
            このリンクは無効または期限切れです。パスワードリセットを再度お試しください。
          </p>
          <Link
            href="/forgot-password"
            className="block w-full text-center bg-[#06C755] hover:bg-[#04a344] text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            パスワードリセットページへ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-2">新しいパスワードを設定</h1>
        <p className="text-sm text-[#8fa3b8] mb-8">
          8文字以上の新しいパスワードを入力してください。
        </p>

        {error && (
          <div className="mb-6 bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-[#ff4757] text-sm px-4 py-3 rounded-xl">
            {error}
            {(error.includes('無効') || error.includes('期限')) && (
              <Link href="/forgot-password" className="block mt-2 text-[#06C755] hover:text-[#04a344] text-xs font-medium">
                パスワードリセットを再送信 &rarr;
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className="block text-sm text-[#8fa3b8] mb-1.5">
              新しいパスワード
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                placeholder="8文字以上"
                className={`w-full bg-[#0a0f1c] border text-[#f0f4f8] rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none transition-colors placeholder:text-[#8494a7] ${
                  passwordError ? 'border-[rgba(255,71,87,0.5)] focus:border-[rgba(255,71,87,0.7)]' : 'border-[rgba(255,255,255,0.07)] focus:border-[rgba(6,199,85,0.4)]'
                }`}
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
            {passwordStrength && (
              <div className="mt-2">
                <div
                  className="h-1 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={parseInt(passwordStrength.width)}
                  aria-valuetext={`パスワード強度: ${passwordStrength.label}`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: passwordStrength.color }}>
                  パスワード強度: {passwordStrength.label}
                </p>
              </div>
            )}
            {passwordError && (
              <p className="text-[#ff4757] text-xs mt-1">{passwordError}</p>
            )}
          </div>
          <div>
            <label htmlFor="reset-password-confirm" className="block text-sm text-[#8fa3b8] mb-1.5">
              パスワード（確認）
            </label>
            <div className="relative">
              <input
                id="reset-password-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                required
                placeholder="もう一度入力"
                className={`w-full bg-[#0a0f1c] border text-[#f0f4f8] rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none transition-colors placeholder:text-[#8494a7] ${
                  confirmError ? 'border-[rgba(255,71,87,0.5)] focus:border-[rgba(255,71,87,0.7)]' : 'border-[rgba(255,255,255,0.07)] focus:border-[rgba(6,199,85,0.4)]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8494a7] hover:text-[#8fa3b8] transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
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
            {confirmError && (
              <p className="text-[#ff4757] text-xs mt-1">{confirmError}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-white font-bold py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            {loading ? '変更中...' : 'パスワードを変更する'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#8494a7]">
          <Link href="/login" className="text-[#06C755] hover:text-[#04a344] transition-colors">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-[#8fa3b8]">読み込み中...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
