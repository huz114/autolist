'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Job = {
  id: string
  keyword: string
  industry: string | null
  location: string | null
  totalFound: number
  status: string
}

type UserProfile = {
  email: string
  name: string | null
  companyName: string | null
  companyUrl: string | null
  phone: string | null
  senderEmail: string | null
  senderTitle: string | null
}

type ToastState = {
  message: string
  type: 'success' | 'error'
} | null

export default function ComposeClient({ job, userEmail }: { job: Job; userEmail: string }) {
  // 送信者情報
  const [companyName, setCompanyName] = useState('')
  const [personName, setPersonName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [title, setTitle] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // メッセージ
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [savingMessage, setSavingMessage] = useState(false)

  // ローディング
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState(true)

  // トースト
  const [toast, setToast] = useState<ToastState>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // プロフィール・メッセージの初期ロード
  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          const u: UserProfile = data.user
          setCompanyName(u.companyName ?? '')
          setPersonName(u.name ?? '')
          setPhone(u.phone ?? '')
          setCompanyUrl(u.companyUrl ?? '')
          setTitle(u.senderTitle ?? '')
          setSenderEmail(u.senderEmail ?? u.email ?? '')
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setLoadingProfile(false))

    fetch('/api/user/last-message')
      .then((r) => r.json())
      .then((data) => {
        if (data.lastSubject) setSubject(data.lastSubject)
        if (data.lastBody) setMessageBody(data.lastBody)
      })
      .catch(() => {/* silent */})
      .finally(() => setLoadingMessage(false))
  }, [])

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

  const isProfileComplete = companyName.trim() && personName.trim() && senderEmail.trim()
  const isMessageComplete = subject.trim() && messageBody.trim()
  const canProceed = isProfileComplete && isMessageComplete

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
          href={`/autolist-results/${job.id}`}
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          ← リストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">フォーム送信の準備</h1>
        <p className="text-sm text-gray-400">送信者情報とメッセージを設定してください</p>
      </div>

      {/* Job情報バナー */}
      <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">キーワード</span>
          <span className="text-white font-medium">{job.keyword}</span>
        </div>
        {job.industry && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">業種</span>
            <span className="text-white">{job.industry}</span>
          </div>
        )}
        {job.location && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">エリア</span>
            <span className="text-white">{job.location}</span>
          </div>
        )}
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">収集件数</span>
          <span className="text-orange-400 font-medium">{job.totalFound}件</span>
        </div>
      </div>

      {/* セクション①: 送信者情報 */}
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg">
            セクション 1
          </span>
          <h2 className="text-lg font-semibold text-white">送信者情報</h2>
        </div>
        <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 mt-2 mb-5">
          <span className="text-orange-400 mt-0.5">💡</span>
          <p className="text-sm text-orange-200">
            フォーム送信時に Chrome 拡張機能で各項目へ自動入力できます。一度保存すると次回以降は自動でセットされます。
          </p>
        </div>

        {loadingProfile ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 送信用メールアドレス（編集可能） */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                送信用メールアドレス
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder={userEmail}
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-600">フォーム送信時に使用するアドレス。ログイン用アドレスとは別に設定できます。</p>
            </div>

            {/* 会社名 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                会社名
                <span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社サンプル"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {/* 担当者名 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                担当者名
                <span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="山田 太郎"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">電話番号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03-0000-0000"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {/* 会社URL */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">会社URL</label>
              <input
                type="url"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://example.co.jp"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {/* 役職・部署 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">役職・部署</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="営業部 主任"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="mt-2 w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {savingProfile ? '保存中...' : '送信者情報を保存'}
            </button>
          </div>
        )}
      </div>

      {/* セクション②: メッセージ */}
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-lg">
            セクション 2
          </span>
          <h2 className="text-lg font-semibold text-white">メッセージ</h2>
        </div>

        {loadingMessage ? (
          <div className="space-y-3">
            <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-48 bg-white/5 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 件名 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                件名
                <span className="ml-1 text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="【ご提案】〇〇サービスのご紹介"
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                本文
                <span className="ml-1 text-orange-400">*</span>
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={14}
                placeholder="はじめまして。〇〇株式会社の山田と申します。&#10;&#10;この度はご連絡いたしました..."
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600 resize-none"
              />
            </div>

            <button
              onClick={handleSaveMessage}
              disabled={savingMessage}
              className="mt-2 w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {savingMessage ? '保存中...' : 'メッセージを保存'}
            </button>
          </div>
        )}
      </div>

      {/* フォーム送信へ進むボタン */}
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6">
        {!canProceed && (
          <p className="text-xs text-gray-500 mb-4 text-center">
            送信者情報（会社名・担当者名）とメッセージ（件名・本文）を入力してから進んでください
          </p>
        )}
        <a
          href={`/send/${job.id}`}
          className={`block w-full text-center font-medium py-3 rounded-xl transition-colors text-base ${
            canProceed
              ? 'bg-orange-500 hover:bg-orange-400 text-white'
              : 'bg-white/5 text-gray-500 pointer-events-none cursor-not-allowed'
          }`}
          aria-disabled={!canProceed}
          tabIndex={canProceed ? 0 : -1}
        >
          フォーム送信へ進む →
        </a>
      </div>
    </div>
  )
}
