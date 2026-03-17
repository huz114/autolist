'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

type Company = {
  id: string
  companyName: string | null
  url: string
  industry: string | null
  location: string | null
}

type Profile = {
  companyName: string
  personName: string
  senderEmail: string
  phone: string
  companyUrl: string
  title: string
}

type Message = {
  subject: string
  body: string
}

type Props = {
  jobId: string
  keyword: string
  industry: string | null
  location: string | null
  companies: Company[]
  initialProfile: Profile
  initialMessage: Message
  hasProfile: boolean
  hasMessage: boolean
}

type ToastState = {
  message: string
  type: 'success' | 'error'
} | null

export default function SendClient({
  jobId,
  keyword,
  industry,
  location,
  companies,
  initialProfile,
  initialMessage,
  hasProfile,
  hasMessage,
}: Props) {
  // トグル状態（初回は開く、2回目以降は閉じる）
  const [profileOpen, setProfileOpen] = useState(!hasProfile)
  const [messageOpen, setMessageOpen] = useState(!hasMessage)
  const [companiesOpen, setCompaniesOpen] = useState(false)

  // 送信者情報
  const [companyName, setCompanyName] = useState(initialProfile.companyName)
  const [personName, setPersonName] = useState(initialProfile.personName)
  const [senderEmail, setSenderEmail] = useState(initialProfile.senderEmail)
  const [phone, setPhone] = useState(initialProfile.phone)
  const [companyUrl, setCompanyUrl] = useState(initialProfile.companyUrl)
  const [title, setTitle] = useState(initialProfile.title)
  const [savingProfile, setSavingProfile] = useState(false)

  // メッセージ
  const [subject, setSubject] = useState(initialMessage.subject)
  const [messageBody, setMessageBody] = useState(initialMessage.body)
  const [savingMessage, setSavingMessage] = useState(false)

  // トースト
  const [toast, setToast] = useState<ToastState>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // プロフィール保存
  async function handleSaveProfile() {
    if (!companyName.trim() || !personName.trim()) {
      showToast('会社名と担当者名は必須です', 'error')
      return
    }
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, personName, phone, companyUrl, title, senderEmail }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '保存に失敗しました')
      }
      showToast('送信者情報を保存しました', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存に失敗しました', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  // メッセージ保存
  async function handleSaveMessage() {
    if (!subject.trim() || !messageBody.trim()) {
      showToast('件名と本文は必須です', 'error')
      return
    }
    setSavingMessage(true)
    try {
      const res = await fetch('/api/user/last-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body: messageBody }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '保存に失敗しました')
      }
      showToast('メッセージを保存しました', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存に失敗しました', 'error')
    } finally {
      setSavingMessage(false)
    }
  }

  // 送信ボタンの有効状態
  const isProfileComplete = companyName.trim() && personName.trim()
  const isMessageComplete = subject.trim() && messageBody.trim()
  const canSend = isProfileComplete && isMessageComplete

  // 送信ハンドラ
  function handleSend() {
    if (!canSend) return
    const ok = window.confirm(`${companies.length}件の企業にフォーム送信します。よろしいですか？`)
    if (ok) {
      showToast('送信機能は準備中です', 'error')
    }
  }

  const inputClass =
    'w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* トースト */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-green-500/20 border border-green-500/40 text-green-300'
              : 'bg-red-500/20 border border-red-500/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ヘッダー */}
      <div className="mb-8">
        <Link
          href={`/autolist-results/${jobId}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          &larr; リストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">フォーム送信</h1>
        <p className="text-sm text-gray-400">
          {keyword}
          {industry ? ` / ${industry}` : ''}
          {location ? ` / ${location}` : ''}
        </p>
      </div>

      {/* 送信先概要 */}
      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-5 py-4 mb-6">
        <p className="text-sm text-emerald-300 font-medium">
          {companies.length}件の企業にフォーム送信します。
          {hasProfile
            ? 'メッセージを確認・入力して、送信ボタンを押してください。'
            : '送信者情報とメッセージを入力して、送信ボタンを押してください。'}
        </p>
      </div>

      {/* セクション1: 送信者情報（トグル） */}
      <div className="bg-gray-800 rounded-lg mb-4 overflow-hidden">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg">1</span>
            <h2 className="text-base font-semibold text-white">送信者情報</h2>
            {isProfileComplete && !profileOpen && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                {companyName} / {personName}
              </span>
            )}
          </div>
          <span
            className={`text-gray-400 text-sm inline-block transition-transform duration-200 ${profileOpen ? 'rotate-90' : 'rotate-0'}`}
          >
            &#x25B6;
          </span>
        </button>

        {profileOpen && (
          <div className="px-5 pb-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                会社名<span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社サンプル"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                担当者名<span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="山田 太郎"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">メールアドレス</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="info@example.co.jp"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">電話番号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03-0000-0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">会社URL</label>
              <input
                type="url"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://example.co.jp"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">役職・部署</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="営業部 主任"
                className={inputClass}
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {savingProfile ? '保存中...' : '送信者情報を保存'}
            </button>
          </div>
        )}
      </div>

      {/* セクション2: メッセージ（トグル） */}
      <div className="bg-gray-800 rounded-lg mb-4 overflow-hidden">
        <button
          onClick={() => setMessageOpen(!messageOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg">2</span>
            <h2 className="text-base font-semibold text-white">メッセージ</h2>
            {isMessageComplete && !messageOpen && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded truncate max-w-[200px]">
                {subject}
              </span>
            )}
          </div>
          <span
            className={`text-gray-400 text-sm inline-block transition-transform duration-200 ${messageOpen ? 'rotate-90' : 'rotate-0'}`}
          >
            &#x25B6;
          </span>
        </button>

        {messageOpen && (
          <div className="px-5 pb-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                件名<span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="【ご提案】〇〇サービスのご紹介"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                本文<span className="ml-1 text-orange-400">*</span>
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={10}
                placeholder={'はじめまして。〇〇株式会社の山田と申します。\n\nこの度はご連絡いたしました...'}
                className={`${inputClass} resize-none`}
              />
            </div>
            <button
              onClick={handleSaveMessage}
              disabled={savingMessage}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {savingMessage ? '保存中...' : 'メッセージを保存'}
            </button>
          </div>
        )}
      </div>

      {/* セクション3: 送信先企業リスト（トグル、デフォルト閉じ） */}
      <div className="bg-gray-800 rounded-lg mb-8 overflow-hidden">
        <button
          onClick={() => setCompaniesOpen(!companiesOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg">3</span>
            <h2 className="text-base font-semibold text-white">送信先企業リスト</h2>
            <span className="text-xs text-gray-400">{companies.length}件</span>
          </div>
          <span
            className={`text-gray-400 text-sm inline-block transition-transform duration-200 ${companiesOpen ? 'rotate-90' : 'rotate-0'}`}
          >
            &#x25B6;
          </span>
        </button>

        {companiesOpen && (
          <div className="px-5 pb-5">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {companies.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <span className="text-xs text-gray-600 tabular-nums shrink-0 w-6 text-right">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">
                      {c.companyName ?? c.url}
                    </p>
                    <div className="flex gap-2 text-xs text-gray-500">
                      {c.industry && <span>{c.industry}</span>}
                      {c.location && <span>{c.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 送信ボタン */}
      <div>
        {!canSend && (
          <p className="text-xs text-gray-500 text-center mb-3">
            送信者情報（会社名・担当者名）とメッセージ（件名・本文）を入力してから送信できます
          </p>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`w-full font-medium py-4 rounded-xl transition-colors text-base ${
            canSend
              ? 'bg-orange-500 hover:bg-orange-400 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {companies.length}件に送信する
        </button>
      </div>
    </div>
  )
}
