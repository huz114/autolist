'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '送信に失敗しました')
        setLoading(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('送信に失敗しました。しばらく後にもう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#06C755]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#06C755]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-3">お問い合わせを受け付けました</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              メールにてご返信いたします。<br />
              しばらくお待ちください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">お問い合わせ</h1>
          <p className="text-sm text-gray-400 mb-8">
            ご質問・ご要望がございましたらお気軽にお問い合わせください
          </p>

          {error && (
            <div className="mb-6 bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                お名前 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="山田 太郎"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                メールアドレス <span className="text-red-400">*</span>
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
                お問い合わせ内容 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                placeholder="お問い合わせ内容をご記入ください"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#06C755] hover:bg-[#05b34a] disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? '送信中...' : '送信する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
