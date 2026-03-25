'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useFocusTrap } from '@/lib/useFocusTrap'
import type { Props, ToastState, Template } from './types'
import { STEPS } from './constants'
import { findUnfilledPlaceholders } from './utils'
import ProfileStep from './ProfileStep'
import MessageStep from './MessageStep'
import ConfirmStep from './ConfirmStep'
import SendStep from './SendStep'

export default function SendClient({
  jobId,
  keyword,
  industry,
  location,
  companies,
  totalUrlCount,
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

  // 送信完了カウンター
  const [isSendStarted, setIsSendStarted] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [sentCompanies, setSentCompanies] = useState<string[]>([])
  const sentCompaniesRef = useRef<string[]>([])

  // shiryolog-submission-completed リスナー
  useEffect(() => {
    if (!isSendStarted) return

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'shiryolog-submission-completed') return
      const { companyName: cn, formUrl, companyDomain } = event.data as {
        companyId: string
        companyName: string
        companyDomain?: string
        formUrl: string
      }
      const label = cn || formUrl || '不明'
      // 重複防止（formUrl ベース）
      if (sentCompaniesRef.current.includes(formUrl)) return
      sentCompaniesRef.current = [...sentCompaniesRef.current, formUrl]
      setSentCompanies(prev => [...prev, label])
      setSentCount(prev => prev + 1)

      // autolist DB に送信記録を保存
      fetch('/api/send/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          companyName: cn || null,
          companyDomain: companyDomain || null,
          formUrl: formUrl || null,
          subject,
          messageBody,
        }),
      }).catch((err) => {
        console.error('Failed to record send:', err)
      })
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isSendStarted, jobId, subject, messageBody])

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
          // 送信完了カウンターを開始
          setSentCount(0)
          setSentCompanies([])
          sentCompaniesRef.current = []
          setIsSendStarted(true)
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
    'w-full bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] text-[#f0f4f8] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[rgba(6,199,85,0.4)] transition-colors placeholder:text-[#8494a7]'

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

            {/* ステップ1: インストール */}
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
                  // TODO: Web Store公開後にURLを差し替え
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

            {/* ステップ2: 使い方 */}
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

            {/* 注意事項 */}
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
            <p className="text-[11px] text-[#8494a7] mt-1.5">
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
          <ConfirmStep companies={companies} totalUrlCount={totalUrlCount} />
        )}

        {currentStep === 3 && (
          <SendStep
            jobId={jobId}
            companies={companies}
            companyName={companyName}
            personName={personName}
            furigana={furigana}
            senderEmail={senderEmail}
            phone={phone}
            companyUrl={companyUrl}
            title={title}
            subject={subject}
            messageBody={messageBody}
            canSend={canSend}
            sending={sending}
            extensionNotFound={extensionNotFound}
            isSendStarted={isSendStarted}
            sentCount={sentCount}
            sentCompanies={sentCompanies}
            onSend={handleSend}
            onSetStep={setCurrentStep}
            onOpenExtensionModal={() => setExtensionModalOpen(true)}
          />
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
                {currentStep === 0 ? '会社名と担当者名を入力してください' : '件名と本文を入力してください'}
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
