'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useFocusTrap } from '@/lib/useFocusTrap'
import ProfileStep from '../[jobId]/ProfileStep'
import MessageStep from '../[jobId]/MessageStep'
import { findUnfilledPlaceholders } from '../[jobId]/utils'
import { TEMPLATES } from '../[jobId]/constants'
import type { Template } from '../[jobId]/types'

type ToastState = {
  message: string
  type: 'success' | 'error'
} | null

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

type BulkCompany = {
  id: string
  jobId: string
  companyName: string | null
  domain: string
  formUrl: string | null
  industry: string | null
  location: string | null
  hasForm: boolean
  sentAt: string | null
}

type Props = {
  companyIds: string[]
  initialProfile: Profile
  initialMessage: Message
}

const STEPS = [
  { label: '送信者情報', shortLabel: '情報' },
  { label: 'メッセージ', shortLabel: 'MSG' },
  { label: '送信先確認', shortLabel: '確認' },
  { label: '送信', shortLabel: '送信' },
] as const

export default function BulkSendClient({
  companyIds,
  initialProfile,
  initialMessage,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0)

  // 企業データ
  const [companies, setCompanies] = useState<BulkCompany[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const cooldownMs = 30 * 24 * 60 * 60 * 1000

  // 送信者情報
  const [companyName, setCompanyName] = useState(initialProfile.companyName)
  const [personName, setPersonName] = useState(initialProfile.personName)
  const [furigana, setFurigana] = useState(initialProfile.furigana)
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

  // Chrome拡張モーダル
  const [extensionModalOpen, setExtensionModalOpen] = useState(false)
  const extensionModalRef = useFocusTrap(extensionModalOpen, () => setExtensionModalOpen(false))

  // 拡張機能未検出エラー
  const [extensionNotFound, setExtensionNotFound] = useState(false)

  // トースト
  const [toast, setToast] = useState<ToastState>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000)
  }, [])

  // 企業データ取得
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies')
        if (!res.ok) throw new Error('企業データの取得に失敗しました')
        const data = await res.json()
        const allCompanies: BulkCompany[] = data.companies || []
        // companyIds に含まれるもののみ
        const idSet = new Set(companyIds)
        const matched = allCompanies.filter((c: BulkCompany) => idSet.has(c.id))
        setCompanies(matched)
      } catch {
        showToast('企業データの取得に失敗しました', 'error')
      } finally {
        setLoadingCompanies(false)
      }
    }
    fetchCompanies()
  }, [companyIds, showToast])

  // 送信可能企業（フォームあり + クールダウン外）
  const sendableCompanies = companies.filter(
    (c) =>
      c.hasForm &&
      c.formUrl &&
      (!c.sentAt || Date.now() - new Date(c.sentAt).getTime() >= cooldownMs)
  )
  const cooldownCompanies = companies.filter(
    (c) =>
      c.sentAt && Date.now() - new Date(c.sentAt).getTime() < cooldownMs
  )

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

  // 署名ブロック生成
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
  const canSend = isProfileComplete && isMessageComplete && sendableCompanies.length > 0

  const [sending, setSending] = useState(false)

  // 送信完了カウンター
  const [isSendStarted, setIsSendStarted] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [sentCompanyNames, setSentCompanyNames] = useState<string[]>([])
  const sentCompaniesRef = useRef<string[]>([])

  // shiryolog-submission-completed リスナー
  useEffect(() => {
    if (!isSendStarted) return

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'shiryolog-submission-completed') return
      const { companyName: cn, companyDomain, formUrl } = event.data as {
        companyId: string
        companyName: string
        companyDomain?: string
        formUrl: string
      }
      const label = cn || formUrl || '不明'
      // 重複防止（formUrl ベース）
      if (sentCompaniesRef.current.includes(formUrl)) return
      sentCompaniesRef.current = [...sentCompaniesRef.current, formUrl]
      setSentCompanyNames((prev) => [...prev, label])
      setSentCount((prev) => prev + 1)

      // autolist DB に送信記録を保存（formUrl or domainで該当企業のjobIdを逆引き）
      const matchedCompany = companies.find(
        (c) => (c.formUrl && c.formUrl === formUrl) || (c.domain && c.domain === companyDomain)
      )
      if (matchedCompany) {
        fetch('/api/send/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: matchedCompany.jobId,
            companyName: cn || matchedCompany.companyName || null,
            companyDomain: companyDomain || matchedCompany.domain || null,
            formUrl: formUrl || null,
            subject,
            messageBody,
          }),
        }).catch((err) => {
          console.error('Failed to record send:', err)
        })
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isSendStarted, companies, subject, messageBody])

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
    const ok = window.confirm(`${sendableCompanies.length}件の企業にフォーム送信します。よろしいですか？`)
    if (!ok) return

    setSending(true)
    try {
      const res = await fetch('/api/send/bulk-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds: sendableCompanies.map((c) => c.id),
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

      const { fillEntries, urls, invalidCount } = await res.json()

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
          setSentCount(0)
          setSentCompanyNames([])
          sentCompaniesRef.current = []
          setIsSendStarted(true)
          const invalidMsg = invalidCount > 0
            ? `（${invalidCount}件はフォームに接続できないため除外されました）`
            : ''
          showToast(
            `${fillEntries.length}件の送信を開始しました。各タブでフォーム送信を確認してください。${invalidMsg}`,
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

  // 残りの未送信企業に再送信
  async function handleRetrySend() {
    // sentCompaniesRef.current に含まれるformUrlは送信済み → それ以外を再送信
    const sentFormUrls = new Set(sentCompaniesRef.current)
    const remainingCompanies = sendableCompanies.filter(
      (c) => c.formUrl && !sentFormUrls.has(c.formUrl)
    )
    if (remainingCompanies.length === 0) {
      showToast('再送信対象の企業がありません', 'error')
      return
    }
    const ok = window.confirm(`残りの${remainingCompanies.length}件に再送信します。よろしいですか？`)
    if (!ok) return

    setSending(true)
    try {
      const res = await fetch('/api/send/bulk-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds: remainingCompanies.map((c) => c.id),
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
        throw new Error(d.error || '再送信の開始に失敗しました')
      }

      const { fillEntries, urls, invalidCount: retryInvalidCount } = await res.json()

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
          const retryInvalidMsg = retryInvalidCount > 0
            ? `（${retryInvalidCount}件は接続不可のため除外）`
            : ''
          showToast(
            `${fillEntries.length}件の再送信を開始しました${retryInvalidMsg}`,
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
        err instanceof Error ? err.message : '再送信の開始に失敗しました',
        'error'
      )
    } finally {
      setSending(false)
    }
  }

  // Step validation
  function canProceedFromStep(step: number): boolean {
    switch (step) {
      case 0:
        return isProfileComplete
      case 1:
        return isMessageComplete
      case 2:
        return sendableCompanies.length > 0
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
    'w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]'

  const totalSendable = sendableCompanies.length
  const isAllComplete = isSendStarted && sentCount >= totalSendable
  const progressPercent = totalSendable > 0 ? Math.min((sentCount / totalSendable) * 100, 100) : 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* トースト */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[70] max-w-sm px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium transition-all animate-[slideIn_0.3s_ease-out] flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-[#111827] border border-[rgba(6,199,85,0.4)] text-[#06C755]'
              : 'bg-[#111827] border border-[rgba(255,71,87,0.4)] text-[#ff4757]'
          }`}
          style={{ boxShadow: toast.type === 'success' ? '0 4px 24px rgba(6,199,85,0.15)' : '0 4px 24px rgba(255,71,87,0.15)' }}
        >
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div className="flex-1">
            <p>{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 text-[#8494a7] hover:text-[#f0f4f8] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Chrome拡張モーダル */}
      {extensionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setExtensionModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Chrome拡張機能のご案内"
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            ref={extensionModalRef}
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

            <h2 className="text-lg font-bold text-[#f0f4f8] mb-2">Chrome拡張機能のご案内</h2>
            <p className="text-sm text-[#8fa3b8] mb-6">
              フォーム一括送信にはChrome拡張機能のインストールが必要です
            </p>

            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#06C755]/20 text-[#06C755] text-xs font-bold shrink-0">1</span>
                <h3 className="text-sm font-semibold text-[#f0f4f8]">拡張機能をインストール</h3>
              </div>
              <div className="ml-8.5 pl-0.5">
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#8fa3b8] leading-relaxed mb-3">
                  <li>下のボタンからChrome ウェブストアを開く</li>
                  <li>「Chromeに追加」をクリック</li>
                  <li>確認ダイアログで「拡張機能を追加」を選択</li>
                </ol>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Chrome ウェブストアで入手
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#06C755]/20 text-[#06C755] text-xs font-bold shrink-0">2</span>
                <h3 className="text-sm font-semibold text-[#f0f4f8]">フォーム送信を実行</h3>
              </div>
              <div className="ml-8.5 pl-0.5">
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#8fa3b8] leading-relaxed">
                  <li>このページで送信者情報・メッセージを入力</li>
                  <li>「送信する」ボタンをクリック</li>
                  <li>Chrome拡張が各企業のフォームを自動で開いて入力・送信</li>
                  <li>送信状況は送信履歴ページで確認できます</li>
                </ol>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-300/90 leading-relaxed">
                <span className="font-medium">注意:</span> セキュリティ保護のため、送信開始から10分経過すると送信データは自動消去されます。再送信が必要な場合はこのページからやり直してください。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <div className="mb-8">
        <Link
          href="/my-lists"
          className="inline-flex items-center text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors mb-4"
        >
          &larr; 統合リストに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">一括フォーム送信</h1>
            <p className="text-sm text-[#8fa3b8]">
              統合リストから選択した {companyIds.length}件 の企業に送信
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
            <p className="text-[11px] text-[#8494a7] mt-1.5">
              フォーム送信にはChrome拡張機能が必要です
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar / Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-[rgba(255,255,255,0.07)]" />
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
                      : 'bg-[#111827] border-2 border-[rgba(255,255,255,0.07)] text-[#8494a7]'
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
                    isCurrent ? 'text-[#06C755]' : isCompleted ? 'text-emerald-400' : 'text-[#8494a7]'
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
        {currentStep === 0 && (
          <ProfileStep
            companyName={companyName}
            setCompanyName={setCompanyName}
            personName={personName}
            setPersonName={setPersonName}
            furigana={furigana}
            setFurigana={setFurigana}
            senderEmail={senderEmail}
            setSenderEmail={setSenderEmail}
            phone={phone}
            setPhone={setPhone}
            companyUrl={companyUrl}
            setCompanyUrl={setCompanyUrl}
            title={title}
            setTitle={setTitle}
            savingProfile={savingProfile}
            onSaveProfile={handleSaveProfile}
            initialFurigana={initialProfile.furigana}
            inputClass={inputClass}
          />
        )}

        {currentStep === 1 && (
          <MessageStep
            subject={subject}
            setSubject={setSubject}
            messageBody={messageBody}
            setMessageBody={setMessageBody}
            savingMessage={savingMessage}
            onSaveMessage={handleSaveMessage}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleSelectTemplate}
            inputClass={inputClass}
          />
        )}

        {currentStep === 2 && (
          <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">送信先確認</h2>
            <p className="text-sm text-[#8fa3b8] mb-2">
              以下の {sendableCompanies.length}件 の企業にフォーム送信します。
            </p>
            {loadingCompanies ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-6 w-6 text-[#06C755]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-3 text-[#8fa3b8] text-sm">企業データを読み込み中...</span>
              </div>
            ) : (
              <>
                {cooldownCompanies.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-sm mb-4">
                    <span className="text-amber-400 font-medium">
                      {cooldownCompanies.length}件はクールダウン期間中（30日以内に送信済み）のため除外されます
                    </span>
                  </div>
                )}
                {companies.filter((c) => !c.hasForm || !c.formUrl).length > 0 && (
                  <p className="text-xs text-[#8494a7] mb-4 bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                    ※ 選択された{companies.length}件のうち、フォームが検出された{sendableCompanies.length}件が送信対象です。
                  </p>
                )}

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {sendableCompanies.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.07)] transition-colors"
                    >
                      <span className="text-xs text-[#8494a7] tabular-nums shrink-0 w-8 text-right font-mono">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#f0f4f8] truncate">
                          {c.companyName ?? c.domain}
                        </p>
                        <div className="flex gap-2 text-xs text-[#8494a7]">
                          {c.industry && <span>{c.industry}</span>}
                          {c.location && <span>{c.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sendableCompanies.length === 0 && (
                  <div className="text-center py-8 text-[#8494a7] text-sm">
                    送信可能な企業がありません
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
                    <span className="text-[#8494a7] w-24 shrink-0">会社名</span>
                    <span className="text-[#f0f4f8]">{companyName || '-'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#8494a7] w-24 shrink-0">担当者名</span>
                    <span className="text-[#f0f4f8]">{personName || '-'}{furigana ? ` (${furigana})` : ''}</span>
                  </div>
                  {title && (
                    <div className="flex gap-2">
                      <span className="text-[#8494a7] w-24 shrink-0">役職</span>
                      <span className="text-[#f0f4f8]">{title}</span>
                    </div>
                  )}
                  {senderEmail && (
                    <div className="flex gap-2">
                      <span className="text-[#8494a7] w-24 shrink-0">メール</span>
                      <span className="text-[#f0f4f8]">{senderEmail}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex gap-2">
                      <span className="text-[#8494a7] w-24 shrink-0">電話番号</span>
                      <span className="text-[#f0f4f8]">{phone}</span>
                    </div>
                  )}
                  {companyUrl && (
                    <div className="flex gap-2">
                      <span className="text-[#8494a7] w-24 shrink-0">会社URL</span>
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
                    送信先 <span className="text-white ml-1">{sendableCompanies.length}件</span>
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
                    {sendableCompanies.slice(0, 5).map((c) => (
                      <span key={c.id} className="text-xs bg-[rgba(255,255,255,0.04)] text-[#8fa3b8] px-2.5 py-1 rounded-full">
                        {c.companyName ?? c.domain}
                      </span>
                    ))}
                    {sendableCompanies.length > 5 && (
                      <span className="text-xs text-[#8494a7] px-2.5 py-1">
                        ...他 {sendableCompanies.length - 5}件
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

            {/* 送信ボタン or 送信進捗パネル */}
            {isSendStarted ? (
              <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
                {isAllComplete ? (
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-2">
                      <svg className="w-10 h-10 text-[#06C755]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#06C755]">
                      全{totalSendable}件の送信が完了しました
                    </h3>
                  </div>
                ) : (
                  <div className="mb-6">
                    <h3 className="text-base font-bold text-[#f0f4f8] mb-1">送信中...</h3>
                    <p className="text-2xl font-bold text-[#06C755]">
                      {sentCount}/{totalSendable}件 <span className="text-sm font-normal text-[#8fa3b8]">送信完了</span>
                    </p>
                  </div>
                )}

                {/* プログレスバー */}
                <div className="w-full bg-[rgba(255,255,255,0.07)] rounded-full h-3 mb-6 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: '#06C755',
                      boxShadow: '0 0 8px rgba(6,199,85,0.4)',
                    }}
                  />
                </div>

                {/* 送信済み企業リスト */}
                {sentCompanyNames.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <h4 className="text-sm font-semibold text-[#8fa3b8]">送信済み</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {sentCompanyNames.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <svg className="w-4 h-4 text-[#06C755] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-[#f0f4f8] truncate">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 部分完了時の警告 */}
                {sentCount > 0 && sentCount < totalSendable && (
                  <div className="bg-amber-900/15 border border-amber-500/25 rounded-xl px-5 py-4 mb-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-[#f59e0b] mb-1">
                          {totalSendable - sentCount}件は送信できませんでした
                        </p>
                        <p className="text-xs text-[#8fa3b8] leading-relaxed">
                          タブが閉じられた、フォームが見つからなかった、SSL証明書エラーなどの原因が考えられます。「再送信」ボタンから再試行するか、電話やメールで直接アプローチできます。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 次のステップ */}
                {sentCount > 0 && (
                  <div className="border-t border-[rgba(255,255,255,0.07)] pt-6">
                    <h4 className="text-sm font-semibold text-[#8fa3b8] mb-4">次のステップ</h4>
                    <div className="space-y-3">
                      {/* 未送信企業がある場合: 再送信ボタンを最上位に表示 */}
                      {sentCount < totalSendable && (
                        <button
                          onClick={handleRetrySend}
                          disabled={sending}
                          className="w-full text-center bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                        >
                          {sending ? '送信準備中...' : `残り${totalSendable - sentCount}件に再送信する`}
                        </button>
                      )}
                      <Link
                        href="/send-history"
                        className={`block text-center ${sentCount < totalSendable ? 'bg-[#0a0f1c] border border-[#06C755] text-[#06C755] hover:bg-[#06C755] hover:text-white' : 'bg-[#06C755] hover:bg-[#04a344] text-white'} py-3 rounded-xl font-bold text-sm transition-colors`}
                      >
                        送信履歴を確認する
                      </Link>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                        <Link
                          href="/my-lists"
                          className="text-sm text-[#06C755] hover:underline transition-colors"
                        >
                          統合リストに戻る
                        </Link>
                        <Link
                          href="/"
                          className="text-sm text-[#06C755] hover:underline transition-colors"
                        >
                          新しいリストを作成する
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {sentCount === 0 && (
                  <Link
                    href="/send-history"
                    className="block text-center text-sm font-medium text-[#8fa3b8] hover:text-[#06C755] transition-colors mt-2"
                  >
                    送信履歴を見る →
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {!canSend && (
                  <p className="text-xs text-[#8494a7] text-center mb-3">
                    送信者情報（会社名・担当者名）とメッセージ（件名・本文）を入力してから送信できます
                  </p>
                )}
                {extensionNotFound && (
                  <div className="bg-[rgba(255,71,87,0.08)] border border-[rgba(255,71,87,0.25)] rounded-xl px-5 py-4 mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-[#ff4757] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm text-[#ff4757] font-medium mb-1">
                          Chrome拡張機能が検出できませんでした
                        </p>
                        <p className="text-xs text-[#8fa3b8] mb-3">
                          拡張機能がインストールされていないか、無効になっている可能性があります。インストール後はこのページを再読み込みしてください。
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setExtensionModalOpen(true)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#06C755] hover:text-[#04a344] transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            インストール手順を見る
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            ページを再読み込み
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSend}
                  disabled={!canSend || sending}
                  className={`w-full font-medium py-4 rounded-xl transition-colors text-base ${
                    canSend && !sending
                      ? 'bg-[#06C755] hover:bg-[#04a344] text-white cursor-pointer'
                      : 'bg-gray-700 text-[#8494a7] cursor-not-allowed'
                  }`}
                >
                  {sending
                    ? '送信準備中...'
                    : `${sendableCompanies.length}件に送信する`}
                </button>
                <a
                  href="/send-history"
                  className="block text-center text-sm text-[#8fa3b8] hover:text-[#06C755] transition-colors mt-3 cursor-pointer"
                >
                  送信履歴を見る →
                </a>
              </div>
            )}
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
              <p className="text-xs text-[#8494a7] hidden sm:block">
                {currentStep === 0 ? '会社名と担当者名を入力してください' : currentStep === 1 ? '件名と本文を入力してください' : '送信可能な企業がありません'}
              </p>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
              className={`inline-flex items-center gap-2 text-sm font-medium px-6 py-2.5 rounded-lg transition-colors ${
                canProceedFromStep(currentStep)
                  ? 'bg-[#06C755] hover:bg-[#04a344] text-white cursor-pointer'
                  : 'bg-gray-700 text-[#8494a7] cursor-not-allowed'
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

      {/* Back button on step 4 (hidden once send has started) */}
      {currentStep === 3 && !isSendStarted && (
        <div className="mt-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors px-5 py-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.1)] cursor-pointer"
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
