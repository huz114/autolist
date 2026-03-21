'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
  furigana: string
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

type Template = {
  id: string
  title: string
  description: string
  subject: string
  body: string
}

const TEMPLATES: Template[] = [
  {
    id: 'service',
    title: 'サービス提案',
    description: '自社サービスを紹介したい時に',
    subject: '【ご提案】弊社サービスのご紹介',
    body: `突然のご連絡失礼いたします。
{会社名}の{担当者名}と申します。

貴社のホームページを拝見し、弊社サービスがお役に立てるのではないかと思い、ご連絡いたしました。

弊社では{自社サービス概要}を提供しており、貴社の業務効率化に貢献できると考えております。

もしよろしければ、15分ほどお時間をいただき、サービスの概要をご説明できればと存じます。

ご興味がございましたら、お気軽にご返信いただけますと幸いです。
何卒よろしくお願いいたします。`,
  },
  {
    id: 'partnership',
    title: '協業・提携提案',
    description: '協業やパートナーシップを打診したい時に',
    subject: '【協業のご相談】{会社名}です',
    body: `突然のご連絡失礼いたします。
{会社名}の{担当者名}と申します。

貴社の事業内容を拝見し、弊社との協業により相互にメリットを生み出せるのではないかと考え、ご連絡いたしました。

弊社は{自社事業概要}を展開しており、貴社とのシナジーを感じております。

一度お打ち合わせの機会をいただけないでしょうか。
ご検討のほど、よろしくお願いいたします。`,
  },
  {
    id: 'exchange',
    title: '情報交換',
    description: '業界の情報交換を依頼したい時に',
    subject: '【情報交換のお願い】{会社名}の{担当者名}です',
    body: `突然のご連絡失礼いたします。
{会社名}の{担当者名}と申します。

貴社の取り組みに大変興味を持ち、ぜひ情報交換させていただきたくご連絡いたしました。

弊社でも同業界にて{自社事業概要}に取り組んでおり、業界の動向や課題について意見交換ができればと考えております。

オンラインで30分ほどお時間をいただければ幸いです。
ご都合の良い日時をお知らせいただけますと助かります。`,
  },
  {
    id: 'seminar',
    title: 'セミナー・イベント案内',
    description: '無料セミナーやイベントに招待したい時に',
    subject: '【ご招待】無料セミナーのご案内',
    body: `突然のご連絡失礼いたします。
{会社名}の{担当者名}と申します。

この度、{セミナーテーマ}をテーマにしたセミナーを開催する運びとなりましたので、ぜひご参加いただきたくご案内いたします。

■ 開催概要
日時: {日時}
場所: {場所（オンライン等）}
参加費: 無料

貴社のお役に立てる内容かと存じますので、ぜひご検討ください。

何卒よろしくお願いいたします。`,
  },
]

/** ひらがなをカタカナに変換（U+3041-U+3096 → U+30A1-U+30F6）、全角スペースは半角に */
function toKatakana(str: string): string {
  return str
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 96))
    .replace(/\u3000/g, ' ')
}

/** {xxx} 形式の未編集プレースホルダーを検出（{会社名}と{担当者名}は自動置換されるため除外） */
function findUnfilledPlaceholders(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g) || []
  return matches.filter((m) => m !== '{会社名}' && m !== '{担当者名}')
}

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
  const [furigana, setFurigana] = useState(initialProfile.furigana)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const compositionReadingRef = useRef('')
  const furiganaManuallyEdited = useRef(false)
  // If profile already has furigana saved, treat as manually edited
  useEffect(() => {
    if (initialProfile.furigana) {
      furiganaManuallyEdited.current = true
    }
  }, [])
  const [senderEmail, setSenderEmail] = useState(initialProfile.senderEmail)

  const [phone, setPhone] = useState(initialProfile.phone)
  const [companyUrl, setCompanyUrl] = useState(initialProfile.companyUrl)
  const [title, setTitle] = useState(initialProfile.title)
  const [savingProfile, setSavingProfile] = useState(false)

  // メッセージ
  const [subject, setSubject] = useState(initialMessage.subject)
  const [messageBody, setMessageBody] = useState(initialMessage.body)
  const [savingMessage, setSavingMessage] = useState(false)

  // テンプレート
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

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
        body: JSON.stringify({ companyName, personName, furigana, phone, companyUrl, title, senderEmail }),
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

  // 署名ブロック生成（空の項目は行ごと省略）
  function buildSignature(): string {
    const lines: string[] = []
    if (companyName.trim()) lines.push(companyName.trim())
    if (personName.trim()) lines.push(personName.trim())
    if (title.trim()) lines.push(title.trim())
    if (phone.trim()) lines.push(`TEL: ${phone.trim()}`)
    if (senderEmail.trim()) lines.push(`Mail: ${senderEmail.trim()}`)
    if (companyUrl.trim()) lines.push(`URL: ${companyUrl.trim()}`)
    if (lines.length === 0) return ''
    const sep = '──────────────'
    return `\n${sep}\n${lines.join('\n')}\n${sep}`
  }

  // テンプレート選択
  function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template.id)
    // {会社名} と {担当者名} を自動置換
    let newSubject = template.subject
    let newBody = template.body
    if (companyName.trim()) {
      newSubject = newSubject.replace(/\{会社名\}/g, companyName.trim())
      newBody = newBody.replace(/\{会社名\}/g, companyName.trim())
    }
    if (personName.trim()) {
      newSubject = newSubject.replace(/\{担当者名\}/g, personName.trim())
      newBody = newBody.replace(/\{担当者名\}/g, personName.trim())
    }
    // 署名ブロックを末尾に追加
    newBody += buildSignature()
    setSubject(newSubject)
    setMessageBody(newBody)
  }

  // メッセージ保存
  async function handleSaveMessage() {
    if (!subject.trim() || !messageBody.trim()) {
      showToast('件名と本文は必須です', 'error')
      return
    }
    // 未編集プレースホルダーチェック
    const placeholders = findUnfilledPlaceholders(subject + '\n' + messageBody)
    if (placeholders.length > 0) {
      showToast(`未編集の箇所があります: ${Array.from(new Set(placeholders)).join(', ')}`, 'error')
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

  const [sending, setSending] = useState(false)

  // 送信ハンドラ
  async function handleSend() {
    if (!canSend || sending) return
    // 未編集プレースホルダーチェック
    const placeholders = findUnfilledPlaceholders(subject + '\n' + messageBody)
    if (placeholders.length > 0) {
      const unique = Array.from(new Set(placeholders))
      const proceed = window.confirm(
        `メッセージ内に未編集の箇所（${unique.join(', ')}）があります。このまま送信しますか？`
      )
      if (!proceed) return
    }
    const ok = window.confirm(`${companies.length}件の企業にフォーム送信します。よろしいですか？`)
    if (!ok) return

    setSending(true)
    try {
      const res = await fetch(`/api/send/${jobId}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body: messageBody,
          senderInfo: {
            name: personName,
            furigana,
            email: senderEmail,
            phone,
            companyName,
          },
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '送信の開始に失敗しました')
      }

      const { fillEntries, urls } = await res.json()

      // Chrome拡張機能にデータを送信
      window.postMessage(
        { type: 'shiryolog-batch-fill-request', fillEntries, urls },
        '*'
      )

      // Chrome拡張機能からの応答を待つ
      let extensionResponded = false
      const handleExtensionResponse = (event: MessageEvent) => {
        if (event.data?.type === 'shiryolog-fill-ready') {
          extensionResponded = true
          window.removeEventListener('message', handleExtensionResponse)
          showToast(
            'Chrome拡張機能にデータを送信しました。各タブでフォーム送信を確認してください。',
            'success'
          )
        }
      }
      window.addEventListener('message', handleExtensionResponse)

      // 3秒待って拡張機能が応答しなければ警告
      setTimeout(() => {
        if (!extensionResponded) {
          window.removeEventListener('message', handleExtensionResponse)
          showToast(
            'Chrome拡張機能が検出されませんでした。拡張機能がインストールされているか確認してください。',
            'error'
          )
        }
      }, 3000)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '送信の開始に失敗しました',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  const inputClass =
    'w-full bg-[#0a0a0f] border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#06C755]/50 transition-colors placeholder:text-gray-600'

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">フォーム送信</h1>
            <p className="text-sm text-gray-400">
              {keyword}
              {industry ? ` / ${industry}` : ''}
              {location ? ` / ${location}` : ''}
            </p>
          </div>
          {/* Chrome拡張インストール案内 */}
          <div className="shrink-0 text-right">
            <a
              // TODO: Web Store公開後にURLを差し替え
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 16.09V13.5H7.59L13.41 5.91V10.5h3L10.59 18.09z" />
              </svg>
              Chrome拡張をインストール
            </a>
            <p className="text-[11px] text-gray-500 mt-1.5">
              フォーム送信にはChrome拡張機能が必要です
            </p>
          </div>
        </div>
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
            <span className="text-xs font-bold text-[#06C755] bg-[#06C755]/10 px-2 py-1 rounded-lg">1</span>
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
                会社名<span className="ml-1 text-[#06C755]">*</span>
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
                担当者名<span className="ml-1 text-[#06C755]">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={personName}
                onChange={(e) => {
                  setPersonName(e.target.value)
                  if (!e.target.value) {
                    if (!furiganaManuallyEdited.current) {
                      setFurigana('')
                    }
                    furiganaManuallyEdited.current = false
                  }
                }}
                onCompositionStart={() => {
                  compositionReadingRef.current = ''
                }}
                onCompositionUpdate={(e) => {
                  if (e.data && /[\u3041-\u3096]/.test(e.data)) {
                    compositionReadingRef.current = e.data
                  }
                }}
                onCompositionEnd={() => {
                  if (compositionReadingRef.current && !furiganaManuallyEdited.current) {
                    const katakana = toKatakana(compositionReadingRef.current)
                    setFurigana(prev => prev + katakana)
                  }
                  compositionReadingRef.current = ''
                }}
                placeholder="山田 太郎"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">フリガナ</label>
              <input
                type="text"
                value={furigana}
                onChange={(e) => {
                  setFurigana(e.target.value)
                  furiganaManuallyEdited.current = true
                }}
                placeholder="ヤマダ タロウ"
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
            <span className="text-xs font-bold text-[#06C755] bg-[#06C755]/10 px-2 py-1 rounded-lg">2</span>
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
          <div className="px-5 pb-5">
            <div className="flex flex-col-reverse sm:flex-row gap-4">
              {/* 左カラム: 件名・本文入力 */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    件名<span className="ml-1 text-[#06C755]">*</span>
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
                    本文<span className="ml-1 text-[#06C755]">*</span>
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

              {/* 右カラム: テンプレート一覧 */}
              <div className="sm:w-56 shrink-0 space-y-2">
                <p className="text-xs text-gray-500 mb-1">テンプレート</p>
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`w-full text-left rounded-lg p-3 transition-colors border-2 ${
                      selectedTemplate === tpl.id
                        ? 'border-[#06C755] bg-gray-700'
                        : 'border-transparent bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <p className="text-sm font-bold text-white">{tpl.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </div>
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
            <span className="text-xs font-bold text-[#06C755] bg-[#06C755]/10 px-2 py-1 rounded-lg">3</span>
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

      {/* セキュリティ注意事項 */}
      <div className="bg-amber-900/15 border border-amber-500/25 rounded-xl px-5 py-3.5 mb-6">
        <p className="text-xs text-amber-300/80 leading-relaxed">
          ※ セキュリティ保護のため、一括送信を開始してから10分経過すると、Chrome拡張機能内の送信データは自動的に消去されます。その場合は、このページから再度送信を開始してください。
        </p>
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
          disabled={!canSend || sending}
          className={`w-full font-medium py-4 rounded-xl transition-colors text-base ${
            canSend && !sending
              ? 'bg-[#06C755] hover:bg-[#05b34a] text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {sending ? '送信準備中...' : `${companies.length}件に送信する`}
        </button>
      </div>
    </div>
  )
}
