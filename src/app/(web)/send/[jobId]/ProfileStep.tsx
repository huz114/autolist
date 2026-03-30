'use client'

import { useRef, useEffect } from 'react'
import { toKatakana } from './utils'

type Props = {
  companyName: string
  setCompanyName: (v: string) => void
  personName: string
  setPersonName: (v: string) => void
  furigana: string
  setFurigana: (v: string) => void
  senderEmail: string
  setSenderEmail: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  companyUrl: string
  setCompanyUrl: (v: string) => void
  title: string
  setTitle: (v: string) => void
  address: string
  setAddress: (v: string) => void
  postalCode: string
  setPostalCode: (v: string) => void
  savingProfile: boolean
  onSaveProfile: () => void
  initialFurigana: string
  inputClass: string
}

export default function ProfileStep({
  companyName,
  setCompanyName,
  personName,
  setPersonName,
  furigana,
  setFurigana,
  senderEmail,
  setSenderEmail,
  phone,
  setPhone,
  companyUrl,
  setCompanyUrl,
  title,
  setTitle,
  address,
  setAddress,
  postalCode,
  setPostalCode,
  savingProfile,
  onSaveProfile,
  initialFurigana,
  inputClass,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const compositionReadingRef = useRef('')
  const furiganaManuallyEdited = useRef(false)

  useEffect(() => {
    if (initialFurigana) {
      furiganaManuallyEdited.current = true
    }
  }, [])

  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">送信者情報</h2>
      <p className="text-sm text-[#8fa3b8] mb-6">
        送信先のフォームに自動入力される情報です。正確に入力してください。
      </p>

      <div className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8494a7] mb-1.5">
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
            <label className="block text-xs text-[#8494a7] mb-1.5">
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
                  setFurigana(furigana + katakana)
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
            <label className="block text-xs text-[#8494a7] mb-1.5">フリガナ</label>
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
            <label className="block text-xs text-[#8494a7] mb-1.5">メールアドレス</label>
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
            <label className="block text-xs text-[#8494a7] mb-1.5">電話番号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03-0000-0000"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8494a7] mb-1.5">役職・部署</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="営業部 主任"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8494a7] mb-1.5">会社URL</label>
            <input
              type="url"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://example.co.jp"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-[#8494a7] mb-1.5">郵便番号</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="150-0001"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-[#8494a7] mb-1.5">住所</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="東京都渋谷区..."
            className={inputClass}
          />
        </div>

        <button
          onClick={onSaveProfile}
          disabled={savingProfile}
          className="bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm cursor-pointer disabled:cursor-not-allowed"
        >
          {savingProfile ? '保存中...' : '送信者情報を保存'}
        </button>
      </div>
    </div>
  )
}
