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

const STEPS = [
  { label: '送信者情報', shortLabel: '情報' },
  { label: 'メッセージ', shortLabel: 'MSG' },
  { label: '送信先確認', shortLabel: '確認' },
  { label: '送信', shortLabel: '送信' },
] as const

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

/** 自動入力されるプレースホルダー */
const AUTO_FILL_PLACEHOLDERS = new Set(['{会社名}', '{担当者名}'])

/** テンプレートテキスト内のプレースホルダーを色分けしたReact要素に変換 */
function renderColorCodedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\{[^}]+\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const placeholder = match[0]
    const isAuto = AUTO_FILL_PLACEHOLDERS.has(placeholder)
    parts.push(
      <span
        key={`${match.index}-${placeholder}`}
        className={`inline-block rounded px-1 py-0.5 text-xs font-semibold ${
          isAuto
            ? 'bg-[#06C755]/15 text-[#06C755] border border-[#06C755]/30'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        }`}
      >
        {placeholder}
      </span>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
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
  // Wizard step (0-indexed)
  const [currentStep, setCurrentStep] = useState(0)

  // 送信者情報
  const [companyName, setCompanyName] = useState(initialProfile.companyName)
  const [personName, setPersonName] = useState(initialProfile.personName)
  const [furigana, setFurigana] = useState(initialProfile.furigana)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const compositionReadingRef = useRef('')
  const furiganaManuallyEdited = useRef(false)
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
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  // Chrome拡張モーダル
  const [extensionModalOpen, setExtensionModalOpen] = useState(false)

  // 拡張機能未検出エラー
  const [extensionNotFound, setExtensionNotFound] = useState(false)

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
  const isProfileComplete = !!(companyName.trim() && personName.trim())
  const isMessageComplete = !!(subject.trim() && messageBody.trim())
  const canSend = isProfileComplete && isMessageComplete

  const [sending, setSending] = useState(false)

  // 送信ハンドラ
  async function handleSend() {
    if (!canSend || sending) return
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

      window.postMessage(
        { type: 'shiryolog-batch-fill-request', fillEntries, urls },
        '*'
      )

      setExtensionNotFound(false)
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

      setTimeout(() => {
        if (!extensionResponded) {
          window.removeEventListener('message', handleExtensionResponse)
          setExtensionNotFound(true)
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

  // Step validation for "Next" button
  function canProceedFromStep(step: number): boolean {
    switch (step) {
      case 0:
        return isProfileComplete
      case 1:
        return isMessageComplete
      case 2:
        return companies.length > 0
      default:
        return false
    }
  }

  function handleNext() {
    if (currentStep < 3 && canProceedFromStep(currentStep)) {
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const inputClass =
    'w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#4a6080]'

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

      {/* Chrome拡張モーダル */}
      {extensionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setExtensionModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExtensionModalOpen(false)}
              className="absolute top-4 right-4 text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-bold text-[#f0f4f8] mb-6">Chrome拡張機能のご案内</h2>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#06C755] mb-3">インストール手順</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#8fa3b8] leading-relaxed">
                <li>下のリンクからChrome ウェブストアを開く</li>
                <li>「Chromeに追加」ボタンをクリック</li>
                <li>「拡張機能を追加」を選択</li>
              </ol>
              <a
                // TODO: Web Store公開後にURLを差し替え
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 mt-4 w-full sm:w-auto px-6 py-3 bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Chrome ウェブストアで入手
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#06C755] mb-3">使い方</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-[#8fa3b8] leading-relaxed">
                <li>このページで送信者情報・メッセージを確認</li>
                <li>「送信する」ボタンをクリック</li>
                <li>Chrome拡張が各企業のフォームを自動で開いて送信します</li>
                <li>送信状況はこのページでリアルタイムに確認できます</li>
              </ol>
            </div>

            <p className="text-xs text-amber-300/80 leading-relaxed">
              ※ セキュリティ保護のため、送信開始から10分経過すると送信データは自動消去されます。
            </p>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="mb-8">
        <Link
          href={`/autolist-results/${jobId}`}
          className="inline-flex items-center text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors mb-4"
        >
          &larr; リストに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">フォーム送信</h1>
            <p className="text-sm text-[#8fa3b8]">
              {keyword}
              {industry ? ` / ${industry}` : ''}
              {location ? ` / ${location}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <button
              onClick={() => setExtensionModalOpen(true)}
              className="inline-flex items-center gap-2 border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.07)] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 16.09V13.5H7.59L13.41 5.91V10.5h3L10.59 18.09z" />
              </svg>
              Chrome拡張をインストール
            </button>
            <p className="text-[11px] text-[#4a6080] mt-1.5">
              フォーム送信にはChrome拡張機能が必要です
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar / Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Connecting line (background) */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-[rgba(255,255,255,0.07)]" />
          {/* Connecting line (progress) */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-[#06C755] transition-all duration-500"
            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isCurrent = idx === currentStep
            const isClickable = idx < currentStep || (idx === currentStep + 1 && canProceedFromStep(currentStep))
            return (
              <button
                key={idx}
                onClick={() => {
                  if (idx < currentStep) {
                    setCurrentStep(idx)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  } else if (idx === currentStep + 1 && canProceedFromStep(currentStep)) {
                    setCurrentStep(idx)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={`relative z-10 flex flex-col items-center gap-2 ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-[#06C755] text-white'
                      : isCurrent
                      ? 'bg-[#06C755]/20 border-2 border-[#06C755] text-[#06C755]'
                      : 'bg-[#111827] border-2 border-[rgba(255,255,255,0.07)] text-[#4a6080]'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors whitespace-nowrap ${
                    isCurrent ? 'text-[#06C755]' : isCompleted ? 'text-emerald-400' : 'text-[#4a6080]'
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: 送信者情報 */}
        {currentStep === 0 && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">送信者情報</h2>
            <p className="text-sm text-[#8fa3b8] mb-6">
              送信先のフォームに自動入力される情報です。正確に入力してください。
            </p>

            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#4a6080] mb-1.5">
                    会社名 / 屋号<span className="ml-1 text-[#06C755]">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例: 会社名 / 屋号等"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6080] mb-1.5">
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#4a6080] mb-1.5">フリガナ</label>
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
                  <label className="block text-xs text-[#4a6080] mb-1.5">メールアドレス</label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="info@example.co.jp"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#4a6080] mb-1.5">電話番号</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03-0000-0000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#4a6080] mb-1.5">役職・部署</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="営業部 主任"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#4a6080] mb-1.5">会社URL</label>
                <input
                  type="url"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://example.co.jp"
                  className={inputClass}
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {savingProfile ? '保存中...' : '送信者情報を保存'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: メッセージ */}
        {currentStep === 1 && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">メッセージ</h2>
            <p className="text-sm text-[#8fa3b8] mb-2">
              送信先フォームに入力するメッセージを作成してください。テンプレートから選択することもできます。
            </p>
            <div className="flex items-start gap-2.5 bg-[rgba(6,199,85,0.1)] border-l-4 border-[#06C755] rounded-r-xl px-5 py-4 mb-6">
              <svg className="w-5 h-5 text-[#06C755] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[#c8d6e0] leading-relaxed">
                Chrome拡張機能を使うと、このメッセージがリスト内の全企業フォームに一括で自動入力されます。一度の作成で全件に送信できるため、メッセージの内容をしっかり作り込むことをおすすめします。
              </p>
            </div>

            <div className="space-y-6">
              {/* 1. テンプレート一覧（2x2グリッド） */}
              <div>
                <p className="text-xs text-[#4a6080] mb-2">テンプレート</p>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      aria-label={`テンプレートを選択: ${tpl.title}`}
                      onClick={() => setPreviewTemplate(previewTemplate?.id === tpl.id ? null : tpl)}
                      className={`text-left rounded-xl p-3 transition-colors border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#06C755] relative ${
                        previewTemplate?.id === tpl.id
                          ? 'border-[#06C755] bg-[#06C755]/5'
                          : selectedTemplate === tpl.id
                          ? 'border-[rgba(255,255,255,0.1)] bg-[#0d1320]'
                          : 'border-[rgba(255,255,255,0.1)] bg-[#0d1320] hover:bg-[#111827] hover:border-[rgba(255,255,255,0.2)]'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#f0f4f8]">{tpl.title}</p>
                      <p className="text-xs text-[#8fa3b8] mt-0.5">{tpl.description}</p>
                      {selectedTemplate === tpl.id && previewTemplate?.id !== tpl.id && (
                        <p className="text-[10px] text-[#06C755] mt-1">テンプレート適用中</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. テンプレートプレビュー */}
              {previewTemplate && (
                <div className="border border-[#06C755]/30 bg-[#06C755]/5 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#f0f4f8]">
                      {previewTemplate.title}
                      <span className="ml-2 text-xs font-normal text-[#8fa3b8]">{previewTemplate.description}</span>
                    </h3>
                    <button
                      onClick={() => setPreviewTemplate(null)}
                      className="text-xs text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#06C755] rounded"
                    >
                      閉じる
                    </button>
                  </div>

                  {/* 凡例 */}
                  <div className="flex flex-wrap gap-3 mb-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-[#8fa3b8]">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#06C755]/30 border border-[#06C755]/50" />
                      自動入力（送信時に自動で差し替え）
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-[#8fa3b8]">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500/50" />
                      手動入力（ご自身で入力してください）
                    </span>
                  </div>

                  {/* 件名プレビュー */}
                  <div className="mb-3">
                    <p className="text-[10px] text-[#4a6080] mb-1">件名</p>
                    <div className="text-sm text-[#c8d6e0] bg-[#0a0f1c] rounded-lg px-4 py-2.5 border border-[rgba(255,255,255,0.07)]">
                      {renderColorCodedText(previewTemplate.subject)}
                    </div>
                  </div>

                  {/* 本文プレビュー */}
                  <div className="mb-4">
                    <p className="text-[10px] text-[#4a6080] mb-1">本文</p>
                    <div className="text-sm text-[#c8d6e0] bg-[#0a0f1c] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.07)] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                      {renderColorCodedText(previewTemplate.body)}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleSelectTemplate(previewTemplate)
                      setPreviewTemplate(null)
                      setTimeout(() => {
                        const subjectInput = document.querySelector<HTMLInputElement>('input[placeholder="【ご提案】〇〇サービスのご紹介"]')
                        subjectInput?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }, 100)
                    }}
                    className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    このテンプレートを使う
                  </button>
                </div>
              )}

              {/* 3. 件名 */}
              <div>
                <label className="block text-xs text-[#4a6080] mb-1.5">
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

              {/* 4. 本文 */}
              <div>
                <label className="block text-xs text-[#4a6080] mb-1.5">
                  本文<span className="ml-1 text-[#06C755]">*</span>
                </label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  rows={12}
                  placeholder={'はじめまして。〇〇株式会社の山田と申します。\n\nこの度はご連絡いたしました...'}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* 5. 手動入力警告 */}
              {(() => {
                const unfilled = findUnfilledPlaceholders(messageBody)
                return unfilled.length > 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm">
                    <span className="text-amber-400 font-medium">手動入力が必要な箇所があります: </span>
                    <span className="text-amber-300">{unfilled.join(', ')}</span>
                  </div>
                ) : null
              })()}

              {/* 6. メッセージを保存 */}
              <button
                onClick={handleSaveMessage}
                disabled={savingMessage}
                className="bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
              >
                {savingMessage ? '保存中...' : 'メッセージを保存'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 送信先確認 */}
        {currentStep === 2 && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">送信先確認</h2>
            <p className="text-sm text-[#8fa3b8] mb-6">
              以下の {companies.length}件 の企業にフォーム送信します。内容を確認してください。
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {companies.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.07)] transition-colors"
                >
                  <span className="text-xs text-[#4a6080] tabular-nums shrink-0 w-8 text-right font-mono">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#f0f4f8] truncate">
                      {c.companyName ?? c.url}
                    </p>
                    <div className="flex gap-2 text-xs text-[#4a6080]">
                      {c.industry && <span>{c.industry}</span>}
                      {c.location && <span>{c.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: 送信 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* 最終確認サマリー */}
            <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-bold text-[#f0f4f8] mb-6">送信内容の最終確認</h2>

              {/* 送信者情報サマリー */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#06C755]">送信者情報</h3>
                  <button
                    onClick={() => { setCurrentStep(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="text-xs text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
                  >
                    編集する
                  </button>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-4 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <span className="text-[#4a6080] w-24 shrink-0">会社名</span>
                    <span className="text-[#f0f4f8]">{companyName || '-'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#4a6080] w-24 shrink-0">担当者名</span>
                    <span className="text-[#f0f4f8]">{personName || '-'}{furigana ? ` (${furigana})` : ''}</span>
                  </div>
                  {title && (
                    <div className="flex gap-2">
                      <span className="text-[#4a6080] w-24 shrink-0">役職</span>
                      <span className="text-[#f0f4f8]">{title}</span>
                    </div>
                  )}
                  {senderEmail && (
                    <div className="flex gap-2">
                      <span className="text-[#4a6080] w-24 shrink-0">メール</span>
                      <span className="text-[#f0f4f8]">{senderEmail}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex gap-2">
                      <span className="text-[#4a6080] w-24 shrink-0">電話番号</span>
                      <span className="text-[#f0f4f8]">{phone}</span>
                    </div>
                  )}
                  {companyUrl && (
                    <div className="flex gap-2">
                      <span className="text-[#4a6080] w-24 shrink-0">会社URL</span>
                      <span className="text-[#f0f4f8]">{companyUrl}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* メッセージサマリー */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#06C755]">メッセージ</h3>
                  <button
                    onClick={() => { setCurrentStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="text-xs text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
                  >
                    編集する
                  </button>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-4 space-y-2">
                  <p className="text-sm text-white font-medium">{subject}</p>
                  <p className="text-sm text-[#8fa3b8] whitespace-pre-wrap line-clamp-6">{messageBody}</p>
                </div>
              </div>

              {/* 送信先サマリー */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#06C755]">
                    送信先 <span className="text-white ml-1">{companies.length}件</span>
                  </h3>
                  <button
                    onClick={() => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className="text-xs text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
                  >
                    確認する
                  </button>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-4">
                  <div className="flex flex-wrap gap-2">
                    {companies.slice(0, 5).map((c) => (
                      <span key={c.id} className="text-xs bg-[rgba(255,255,255,0.04)] text-[#8fa3b8] px-2.5 py-1 rounded-full">
                        {c.companyName ?? c.url}
                      </span>
                    ))}
                    {companies.length > 5 && (
                      <span className="text-xs text-[#4a6080] px-2.5 py-1">
                        ...他 {companies.length - 5}件
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* セキュリティ注意事項 */}
            <div className="bg-amber-900/15 border border-amber-500/25 rounded-xl px-5 py-3.5">
              <p className="text-xs text-amber-300/80 leading-relaxed">
                ※ セキュリティ保護のため、一括送信を開始してから10分経過すると、Chrome拡張機能内の送信データは自動的に消去されます。その場合は、このページから再度送信を開始してください。
              </p>
            </div>

            {/* 送信ボタン */}
            <div>
              {!canSend && (
                <p className="text-xs text-[#4a6080] text-center mb-3">
                  送信者情報（会社名・担当者名）とメッセージ（件名・本文）を入力してから送信できます
                </p>
              )}
              {extensionNotFound && (
                <div className="text-center mb-3 space-y-2">
                  <p className="text-xs text-red-400">
                    Chrome拡張機能が検出できません。インストールしてからページをリロードしてください。
                  </p>
                  <button
                    onClick={() => setExtensionModalOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#06C755] hover:text-[#04a344] transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 16.09V13.5H7.59L13.41 5.91V10.5h3L10.59 18.09z" />
                    </svg>
                    Chrome拡張をインストール
                  </button>
                </div>
              )}
              <button
                onClick={handleSend}
                disabled={!canSend || sending}
                className={`w-full font-medium py-4 rounded-xl transition-colors text-base ${
                  canSend && !sending
                    ? 'bg-[#06C755] hover:bg-[#04a344] text-white cursor-pointer'
                    : 'bg-gray-700 text-[#4a6080] cursor-not-allowed'
                }`}
              >
                {sending
                  ? '送信準備中...'
                  : `${companies.length}件に送信する`}
              </button>
              <a
                href="/send-history"
                className="block text-center text-sm text-[#8fa3b8] hover:text-[#06C755] transition-colors mt-3 cursor-pointer"
              >
                送信履歴を見る →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons (Steps 0-2) */}
      {currentStep < 3 && (
        <div className="flex items-center justify-between mt-8">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors px-5 py-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.1)] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!canProceedFromStep(currentStep) && (
              <p className="text-xs text-[#4a6080] hidden sm:block">
                {currentStep === 0 ? '会社名と担当者名を入力してください' : '件名と本文を入力してください'}
              </p>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
              className={`inline-flex items-center gap-2 text-sm font-medium px-6 py-2.5 rounded-lg transition-colors ${
                canProceedFromStep(currentStep)
                  ? 'bg-[#06C755] hover:bg-[#04a344] text-white cursor-pointer'
                  : 'bg-gray-700 text-[#4a6080] cursor-not-allowed'
              }`}
            >
              次へ
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Back button on step 4 */}
      {currentStep === 3 && (
        <div className="mt-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors px-5 py-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.1)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            戻る
          </button>
        </div>
      )}

    </div>
  )
}
