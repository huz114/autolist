'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'

type EmailPattern = {
  type: 'A' | 'B' | 'C'
  title: string
  subject: string
  body: string
}

type Tab = 'url' | 'text'

export default function ComposePage() {
  const params = useParams()
  const jobId = params.jobId as string

  const [tab, setTab] = useState<Tab>('url')
  const [urlInput, setUrlInput] = useState('')
  const [companyInfo, setCompanyInfo] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlError, setUrlError] = useState('')

  const [patterns, setPatterns] = useState<EmailPattern[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const [selected, setSelected] = useState<EmailPattern | null>(null)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  async function handleFetchUrl() {
    if (!urlInput) return
    setFetchingUrl(true)
    setUrlError('')
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'フェッチ失敗')
      setCompanyInfo(data.text)
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'URLの読み込みに失敗しました')
    } finally {
      setFetchingUrl(false)
    }
  }

  async function handleGenerate() {
    if (!companyInfo.trim()) {
      setGenError('会社情報を入力してください')
      return
    }
    setGenerating(true)
    setGenError('')
    setPatterns([])
    setSelected(null)
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, companyInfo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成に失敗しました')
      setPatterns(data.patterns)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'メール文の生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  function handleSelect(pattern: EmailPattern) {
    setSelected(pattern)
    setEditedSubject(pattern.subject)
    setEditedBody(pattern.body)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-white mb-1">メール文を作成</h1>
      <p className="text-sm text-gray-400 mb-8">
        自社情報を入力して、AIが3パターンのメール文を生成します
      </p>

      {/* Step 1: 自社情報入力 */}
      <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          <span className="text-orange-400 mr-2">Step 1</span>自社情報を入力
        </h2>

        {/* タブ */}
        <div className="flex gap-2 mb-5">
          {(['url', 'text'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-4 py-1.5 rounded-lg transition-colors ${
                tab === t
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'url' ? 'URLから読み込む' : 'テキスト入力'}
            </button>
          ))}
        </div>

        {tab === 'url' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://yourcompany.co.jp"
                className="flex-1 bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600"
              />
              <button
                onClick={handleFetchUrl}
                disabled={fetchingUrl || !urlInput}
                className="shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                {fetchingUrl ? '読み込み中...' : '読み込む'}
              </button>
            </div>
            {urlError && (
              <p className="text-sm text-red-400">{urlError}</p>
            )}
          </div>
        )}

        {/* 会社情報テキストエリア（共通） */}
        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-1.5">
            会社情報テキスト（URLから自動取得、または手動入力）
          </label>
          <textarea
            value={companyInfo}
            onChange={(e) => setCompanyInfo(e.target.value)}
            rows={16}
            placeholder="会社名、事業内容、サービス・商品、実績・強み、ターゲット顧客などを記入してください"
            className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors placeholder:text-gray-600 resize-none min-h-[400px]"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !companyInfo.trim()}
          className="mt-4 w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {generating ? 'AI生成中...' : 'メール文を生成する'}
        </button>

        {genError && (
          <p className="mt-3 text-sm text-red-400">{genError}</p>
        )}
      </div>

      {/* Step 2: パターン選択 */}
      {patterns.length > 0 && (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            <span className="text-orange-400 mr-2">Step 2</span>パターンを選択
          </h2>
          <div className="space-y-4">
            {patterns.map((p) => (
              <div
                key={p.type}
                className={`border rounded-xl p-5 cursor-pointer transition-all ${
                  selected?.type === p.type
                    ? 'border-orange-500/50 bg-orange-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => handleSelect(p)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                      パターン{p.type}
                    </span>
                    <span className="text-sm text-gray-300">{p.title}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelect(p) }}
                    className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                      selected?.type === p.type
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    選択
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-1">件名</p>
                <p className="text-sm text-white mb-3">{p.subject}</p>
                <p className="text-xs text-gray-500 mb-1">本文</p>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 編集・送信 */}
      {selected && (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            <span className="text-orange-400 mr-2">Step 3</span>編集して送信へ
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">件名</label>
              <input
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">本文</label>
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={20}
                className="w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition-colors resize-none min-h-[480px]"
              />
            </div>
            <a
              href={`/send/${jobId}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody)}`}
              className="block w-full text-center bg-orange-500 hover:bg-orange-400 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              この文面で送信へ →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
