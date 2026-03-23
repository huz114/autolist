'use client'

import type { Company } from './types'

type Props = {
  companies: Company[]
  companyName: string
  personName: string
  furigana: string
  senderEmail: string
  phone: string
  companyUrl: string
  title: string
  subject: string
  messageBody: string
  canSend: boolean
  sending: boolean
  extensionNotFound: boolean
  onSend: () => void
  onSetStep: (step: number) => void
  onOpenExtensionModal: () => void
}

export default function SendStep({
  companies,
  companyName,
  personName,
  furigana,
  senderEmail,
  phone,
  companyUrl,
  title,
  subject,
  messageBody,
  canSend,
  sending,
  extensionNotFound,
  onSend,
  onSetStep,
  onOpenExtensionModal,
}: Props) {
  return (
    <div className="space-y-6">
      {/* 最終確認サマリー */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-bold text-[#f0f4f8] mb-6">送信内容の最終確認</h2>

        {/* 送信者情報サマリー */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#06C755]">送信者情報</h3>
            <button
              onClick={() => { onSetStep(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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
              onClick={() => { onSetStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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
              onClick={() => { onSetStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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
                <span className="text-xs text-[#8494a7] px-2.5 py-1">
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
                    onClick={onOpenExtensionModal}
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
          onClick={onSend}
          disabled={!canSend || sending}
          className={`w-full font-medium py-4 rounded-xl transition-colors text-base ${
            canSend && !sending
              ? 'bg-[#06C755] hover:bg-[#04a344] text-white cursor-pointer'
              : 'bg-gray-700 text-[#8494a7] cursor-not-allowed'
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
  )
}
