'use client'

import { useState, useEffect } from 'react'

export default function ProfilePage() {
  const [form, setForm] = useState({
    companyName: '',
    personName: '',
    furigana: '',
    phone: '',
    companyUrl: '',
    title: '',
    senderEmail: '',
  })
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setForm({
            companyName: data.user.companyName || '',
            personName: data.user.name || '',
            furigana: data.user.senderFurigana || '',
            phone: data.user.phone || '',
            companyUrl: data.user.companyUrl || '',
            title: data.user.senderTitle || '',
            senderEmail: data.user.senderEmail || '',
          })
          setEmail(data.user.email || '')
        }
      })
  }, [])

  const handleSave = async () => {
    if (!form.companyName || !form.personName) {
      setError('会社名と担当者名は必須です')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await res.json()
        setError(data.error || '保存に失敗しました')
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const inputClass =
    'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f0f4f8] focus:border-[#06C755] focus:outline-none transition-colors w-full'
  const labelClass = 'text-xs text-[#8494a7] mb-1 block'

  return (
    <div className="min-h-[80vh] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-[600px]">
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">プロフィール設定</h1>
        <div className="mb-8 bg-[rgba(6,199,85,0.08)] border border-[rgba(6,199,85,0.25)] rounded-lg px-4 py-3">
          <p className="text-sm text-[#06C755] font-medium">
            フォーム送信時に使用される送信者情報を設定します
          </p>
          <p className="text-xs text-[#8494a7] mt-1">
            ここで設定した情報がChrome拡張のフォーム自動入力に使用されます
          </p>
        </div>

        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 space-y-5">
          {/* 会社名 + 担当者名 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                会社名 <span className="text-[#06C755]">*</span>
              </label>
              <input
                type="text"
                className={inputClass}
                value={form.companyName}
                onChange={e => update('companyName', e.target.value)}
                placeholder="株式会社〇〇"
              />
            </div>
            <div>
              <label className={labelClass}>
                担当者名 <span className="text-[#06C755]">*</span>
              </label>
              <input
                type="text"
                className={inputClass}
                value={form.personName}
                onChange={e => update('personName', e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
          </div>

          {/* フリガナ + 役職 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>フリガナ</label>
              <input
                type="text"
                className={inputClass}
                value={form.furigana}
                onChange={e => update('furigana', e.target.value)}
                placeholder="ヤマダ タロウ"
              />
            </div>
            <div>
              <label className={labelClass}>役職</label>
              <input
                type="text"
                className={inputClass}
                value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="営業部長"
              />
            </div>
          </div>

          {/* 電話番号 + 会社URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>電話番号</label>
              <input
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="03-1234-5678"
              />
            </div>
            <div>
              <label className={labelClass}>会社URL</label>
              <input
                type="url"
                className={inputClass}
                value={form.companyUrl}
                onChange={e => update('companyUrl', e.target.value)}
                placeholder="https://example.co.jp"
              />
            </div>
          </div>

          {/* 送信元メール */}
          <div>
            <label className={labelClass}>
              送信元メールアドレス
              <span className="text-[10px] text-[#6b7280] ml-2">フォーム送信時に相手に通知されるメールアドレス</span>
            </label>
            <input
              type="email"
              className={inputClass}
              value={form.senderEmail}
              onChange={e => update('senderEmail', e.target.value)}
              placeholder="sales@example.co.jp"
            />
          </div>

          {/* 登録メール (readonly) */}
          <div>
            <label className={labelClass}>
              登録メールアドレス
              <span className="text-[10px] text-[#6b7280] ml-2">ログイン・リスト完了通知に使用（変更不可）</span>
            </label>
            <input
              type="email"
              className={`${inputClass} opacity-50 cursor-not-allowed`}
              value={email}
              readOnly
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.4)]"
          >
            {saving ? '保存中...' : '保存する'}
          </button>

          {/* Success toast */}
          {saved && (
            <div className="text-center text-sm text-[#06C755] animate-pulse">
              保存しました
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
