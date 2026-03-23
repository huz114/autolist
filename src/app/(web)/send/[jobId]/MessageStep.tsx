'use client'

import { useState } from 'react'
import type { Template } from './types'
import { TEMPLATES } from './constants'
import { findUnfilledPlaceholders, renderColorCodedText } from './utils'

type Props = {
  subject: string
  setSubject: (v: string) => void
  messageBody: string
  setMessageBody: (v: string) => void
  savingMessage: boolean
  onSaveMessage: () => void
  selectedTemplate: string | null
  onSelectTemplate: (template: Template) => void
  inputClass: string
}

export default function MessageStep({
  subject,
  setSubject,
  messageBody,
  setMessageBody,
  savingMessage,
  onSaveMessage,
  selectedTemplate,
  onSelectTemplate,
  inputClass,
}: Props) {
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  return (
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
        {/* 1. テンプレート一覧 */}
        <div>
          <p className="text-xs text-[#8494a7] mb-2">テンプレート</p>
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
              <p className="text-[10px] text-[#8494a7] mb-1">件名</p>
              <div className="text-sm text-[#c8d6e0] bg-[#0a0f1c] rounded-lg px-4 py-2.5 border border-[rgba(255,255,255,0.07)]">
                {renderColorCodedText(previewTemplate.subject)}
              </div>
            </div>

            {/* 本文プレビュー */}
            <div className="mb-4">
              <p className="text-[10px] text-[#8494a7] mb-1">本文</p>
              <div className="text-sm text-[#c8d6e0] bg-[#0a0f1c] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.07)] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {renderColorCodedText(previewTemplate.body)}
              </div>
            </div>

            <button
              onClick={() => {
                onSelectTemplate(previewTemplate)
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
          <label className="block text-xs text-[#8494a7] mb-1.5">
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
          <label className="block text-xs text-[#8494a7] mb-1.5">
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
          onClick={onSaveMessage}
          disabled={savingMessage}
          className="bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
        >
          {savingMessage ? '保存中...' : 'メッセージを保存'}
        </button>
      </div>
    </div>
  )
}
