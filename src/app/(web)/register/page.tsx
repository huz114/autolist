'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId') || ''
  const lineUserId = searchParams.get('lineUserId') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

    if (!res.ok) {
      setError(data.error || '登録に失敗しました')
      setLoading(false)
      return
    }

    // 登録後、自動ログイン
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('登録は完了しましたが、ログインに失敗しました。ログインページからお試しください。')
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
      router.push('/my-lists')
      router.refresh()
    }
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
              className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              メールアドレス <span className="text-orange-400">*</span>
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
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              パスワード <span className="text-orange-400">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="8文字以上"
              className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? '登録中...' : '無料で登録する'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          既にアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-orange-400 hover:underline">
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
