'use client'

import { useState } from 'react'
import { useFocusTrap } from '@/lib/useFocusTrap'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [messageTouched, setMessageTouched] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const confirmModalRef = useFocusTrap(showConfirm, () => setShowConfirm(false))

  const emailError = emailTouched && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'メールアドレスの形式が正しくありません'
    : ''
  const nameError = nameTouched && !name.trim() ? 'お名前を入力してください' : ''
  const messageError = messageTouched && !message.trim()
    ? 'お問い合わせ内容を入力してください'
    : messageTouched && message.length > 2000
      ? 'お問い合わせ内容は2000文字以内で入力してください'
      : ''

  function handlePreSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameTouched(true)
    setEmailTouched(true)
    setMessageTouched(true)
    if (!name.trim() || !email.trim() || !message.trim()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (message.length > 2000) return
    setShowConfirm(true)
  }

  async function handleSubmit() {
    setShowConfirm(false)
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, email, message }),
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
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#06C755]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#06C755]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#f0f4f8] mb-3">お問い合わせを受け付けました</h1>
            <p className="text-[#8fa3b8] text-sm leading-relaxed">
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
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#f0f4f8] mb-2">お問い合わせ</h1>
          <p className="text-sm text-[#8fa3b8] mb-8">
            ご質問・ご要望がございましたらお気軽にお問い合わせください
          </p>

          {error && (
            <div className="mb-6 bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] text-[#ff4757] text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handlePreSubmit} className="space-y-5">
            <div>
              <label htmlFor="contact-name" className="block text-sm text-[#8fa3b8] mb-1.5">
                お名前 <span className="text-[#ff4757]">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                required
                placeholder="山田 太郎"
                className={`w-full bg-[#0a0f1c] border text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors placeholder:text-[#8494a7] ${
                  nameError ? 'border-[rgba(255,71,87,0.5)] focus:border-[rgba(255,71,87,0.7)]' : 'border-[rgba(255,255,255,0.07)] focus:border-[rgba(6,199,85,0.4)]'
                }`}
              />
              {nameError && (
                <p className="text-[#ff4757] text-xs mt-1">{nameError}</p>
              )}
            </div>
            <div>
              <label htmlFor="contact-company" className="block text-sm text-[#8fa3b8] mb-1.5">
                企業名（任意）
              </label>
              <input
                id="contact-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="株式会社○○"
                className="w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm text-[#8fa3b8] mb-1.5">
                メールアドレス <span className="text-[#ff4757]">*</span>
              </label>
              <input
                id="contact-email"
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
              <label htmlFor="contact-message" className="block text-sm text-[#8fa3b8] mb-1.5">
                お問い合わせ内容 <span className="text-[#ff4757]">*</span>
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onBlur={() => setMessageTouched(true)}
                required
                rows={6}
                maxLength={2000}
                placeholder="お問い合わせ内容をご記入ください"
                className={`w-full bg-[#0a0f1c] border text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors placeholder:text-[#8494a7] resize-none ${
                  messageError ? 'border-[rgba(255,71,87,0.5)] focus:border-[rgba(255,71,87,0.7)]' : 'border-[rgba(255,255,255,0.07)] focus:border-[rgba(6,199,85,0.4)]'
                }`}
              />
              <div className="flex justify-between mt-1">
                {messageError ? (
                  <p className="text-[#ff4757] text-xs">{messageError}</p>
                ) : <span />}
                <span className={`text-xs ${message.length > 1800 ? 'text-[#ffa502]' : 'text-[#8494a7]'}`}>
                  {message.length}/2000
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-60 text-[#f0f4f8] font-bold py-2.5 rounded-full transition-colors"
            >
              {loading ? '送信中...' : '確認して送信'}
            </button>
          </form>

          {/* 送信確認モーダル */}
          {showConfirm && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false) }}
              role="dialog"
              aria-modal="true"
              aria-label="送信内容の確認"
            >
              <div ref={confirmModalRef} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-[#f0f4f8] mb-4">送信内容の確認</h2>
                <div className="space-y-3 mb-6">
                  <div>
                    <span className="text-xs text-[#8494a7]">お名前</span>
                    <p className="text-sm text-[#f0f4f8]">{name}</p>
                  </div>
                  {company && (
                    <div>
                      <span className="text-xs text-[#8494a7]">企業名</span>
                      <p className="text-sm text-[#f0f4f8]">{company}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-[#8494a7]">メールアドレス</span>
                    <p className="text-sm text-[#f0f4f8]">{email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#8494a7]">お問い合わせ内容</span>
                    <p className="text-sm text-[#f0f4f8] whitespace-pre-wrap">{message}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] text-[#8fa3b8] hover:text-[#f0f4f8] font-medium py-2.5 rounded-full transition-colors text-sm cursor-pointer"
                  >
                    修正する
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 bg-[#06C755] hover:bg-[#04a344] text-white font-bold py-2.5 rounded-full transition-all text-sm cursor-pointer hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
                  >
                    送信する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
