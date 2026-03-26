'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// -- Types --

export interface Company {
  id: string
  url: string
  domain: string
  companyName: string | null
  industry: string | null
  location: string | null
  employeeCount: string | null
  capitalAmount: string | null
  phoneNumber: string | null
  representativeName: string | null
  establishedYear: number | null
  businessDescription: string | null
  email: string | null
  hasForm: boolean
  formUrl: string | null
  isPinned: boolean
  isArchived: boolean
  downloadedAt: string | null
  status: string
  createdAt: string
  jobKeyword: string | null
  jobCreatedAt: string | null
  memo: string | null
  memoUpdatedAt: string | null
  sentAt: string | null
  sentSubject: string | null
  sentMessageBody: string | null
  selected?: boolean
}

interface CompanyCardProps {
  company: Company
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  onPinToggle: (id: string) => void
  onArchive: (id: string) => void
  onMemoSave: (id: string, memo: string) => void
}

// -- Icons --

const PhoneIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

const MemoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
)

const SaveCheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="4" rx="1"/>
    <path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/>
    <path d="M9 12h6"/>
    <path d="M9 16h6"/>
  </svg>
)

const ClipboardCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="4" rx="1"/>
    <path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/>
    <path d="m9 14 2 2 4-4"/>
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13"/>
    <path d="M22 2 15 22 11 13 2 9z"/>
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6"/>
    <path d="M10 14 21 3"/>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  </svg>
)

const ArchiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="5" rx="1"/>
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
    <path d="M10 12h4"/>
  </svg>
)

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill={filled ? '#eab308' : 'none'}
    stroke={filled ? '#eab308' : '#5a6a7a'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

// -- Helpers --

function getStatusInfo(company: Company): { label: string; badgeClass: string; borderClass: string } {
  if (company.sentAt) {
    const d = new Date(company.sentAt)
    const label = `送信済み ${d.getMonth() + 1}/${d.getDate()}`
    return {
      label,
      badgeClass: 'bg-[rgba(6,199,85,0.12)] text-[#06C755] border-[rgba(6,199,85,0.25)]',
      borderClass: 'sent',
    }
  }
  if (company.downloadedAt) {
    return {
      label: 'DL済み',
      badgeClass: 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6] border-[rgba(59,130,246,0.25)]',
      borderClass: 'dl',
    }
  }
  return {
    label: '未連絡',
    badgeClass: 'bg-[rgba(255,255,255,0.05)] text-[#8494a7] border-[rgba(255,255,255,0.1)]',
    borderClass: 'unsent',
  }
}

function getCooldownInfo(sentAt: string | null): { inCooldown: boolean; cooldownEnd: string } {
  if (!sentAt) return { inCooldown: false, cooldownEnd: '' }
  const sentMs = new Date(sentAt).getTime()
  const nowMs = Date.now()
  const diffDays = Math.floor((nowMs - sentMs) / (1000 * 60 * 60 * 24))
  if (diffDays < 30) {
    const cooldownEnd = new Date(sentMs + 30 * 24 * 60 * 60 * 1000)
    return {
      inCooldown: true,
      cooldownEnd: `${cooldownEnd.getMonth() + 1}/${cooldownEnd.getDate()}`,
    }
  }
  return { inCooldown: false, cooldownEnd: '' }
}

// -- Component --

export default function CompanyCard({
  company,
  selected,
  onSelect,
  onPinToggle,
  onArchive,
  onMemoSave,
}: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [memoText, setMemoText] = useState(company.memo || '')
  const [memoSaved, setMemoSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [showFullMessage, setShowFullMessage] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const statusInfo = getStatusInfo(company)
  const cooldown = getCooldownInfo(company.sentAt)
  const hasMemo = !!company.memo

  // Sync memo text when company changes
  useEffect(() => {
    setMemoText(company.memo || '')
  }, [company.memo])

  const handleMemoChange = useCallback((value: string) => {
    setMemoText(value)
    setMemoSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onMemoSave(company.id, value)
      setMemoSaved(true)
      setTimeout(() => setMemoSaved(false), 2000)
    }, 500)
  }, [company.id, onMemoSave])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleCopy = useCallback(() => {
    const c = company
    const lines = [c.companyName || c.domain]
    if (c.industry) lines.push(`業種: ${c.industry}`)
    if (c.location) lines.push(`住所: ${c.location}`)
    if (c.phoneNumber) lines.push(`電話: ${c.phoneNumber}`)
    if (c.email) lines.push(`メール: ${c.email}`)
    if (c.url) lines.push(`URL: ${c.url.replace('https://', '').replace('http://', '')}`)
    if (c.representativeName) lines.push(`代表者: ${c.representativeName}`)
    if (c.establishedYear) lines.push(`設立: ${c.establishedYear}年`)
    if (c.employeeCount) lines.push(`従業員数: ${c.employeeCount}`)
    if (c.capitalAmount) lines.push(`資本金: ${c.capitalAmount}`)
    if (c.businessDescription) lines.push(`事業内容: ${c.businessDescription}`)
    if (c.memo) lines.push(`メモ: ${c.memo}`)
    const text = lines.join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [company])

  const handleArchive = useCallback(() => {
    setFadingOut(true)
    setTimeout(() => {
      onArchive(company.id)
    }, 400)
  }, [company.id, onArchive])

  const handleSummaryClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-stop-propagation]')) return
    setExpanded(prev => !prev)
  }, [])

  // Left border color
  const borderLeftColor = statusInfo.borderClass === 'sent'
    ? 'before:bg-[#06C755]'
    : statusInfo.borderClass === 'dl'
      ? 'before:bg-[#3b82f6]'
      : 'before:bg-[#4a5568]'

  return (
    <div
      className={`
        relative bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[10px] overflow-hidden
        transition-all duration-200
        before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-l-[10px] before:transition-colors before:duration-200 ${borderLeftColor}
        hover:border-[rgba(6,199,85,0.4)]
        ${selected ? 'bg-[rgba(6,199,85,0.04)]' : ''}
        ${company.isArchived ? 'opacity-40' : ''}
        ${fadingOut ? 'animate-card-fade-out' : ''}
      `}
    >
      {/* Summary Row */}
      <div
        className="flex items-start gap-3 px-4 py-4 pl-[18px] cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={handleSummaryClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSummaryClick(e as unknown as React.MouseEvent)
          }
        }}
      >
        {/* Checkbox */}
        <div data-stop-propagation className="flex items-center min-w-[24px] min-h-[44px] pt-0.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(company.id, e.target.checked)}
            className="w-[18px] h-[18px] accent-[#06C755] cursor-pointer flex-shrink-0"
            aria-label={`${company.companyName || company.domain}を選択`}
          />
        </div>

        {/* Pin Star */}
        <button
          data-stop-propagation
          onClick={(e) => {
            e.stopPropagation()
            onPinToggle(company.id)
          }}
          className="flex items-center justify-center w-7 h-7 border-none bg-transparent cursor-pointer flex-shrink-0 self-center rounded-[6px] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          aria-label="注力マーク切り替え"
          title="注力マーク"
        >
          <StarIcon filled={company.isPinned} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: name + badges */}
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <span className="text-[15px] font-bold text-[#f0f4f8] whitespace-nowrap overflow-hidden text-ellipsis">
              {company.companyName || company.domain}
            </span>
            <div className="flex gap-[5px] flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-semibold whitespace-nowrap border ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
              {company.hasForm && (
                <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-semibold whitespace-nowrap border bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border-[rgba(245,158,11,0.25)]">
                  フォームあり
                </span>
              )}
              {hasMemo && (
                <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-semibold whitespace-nowrap border bg-[rgba(139,92,246,0.12)] text-[#8b5cf6] border-[rgba(139,92,246,0.25)]">
                  メモあり
                </span>
              )}
            </div>
          </div>

          {/* Meta: industry / location */}
          <div className="text-[13px] text-[#8fa3b8] mb-2">
            {company.industry && <>{company.industry}</>}
            {company.industry && company.location && <span className="mx-1.5 text-[#5a6a7a]">/</span>}
            {company.location && <>{company.location}</>}
          </div>

          {/* Contacts */}
          <div className="flex gap-4 flex-wrap items-center">
            {company.phoneNumber && (
              <span className="inline-flex items-center gap-[5px] text-[13px] text-[#8fa3b8]">
                <span className="text-[#5a6a7a]"><PhoneIcon /></span>
                {company.phoneNumber}
              </span>
            )}
            {company.email && (
              <span className="inline-flex items-center gap-[5px] text-[13px] text-[#8fa3b8]">
                <span className="text-[#5a6a7a]"><MailIcon /></span>
                {company.email}
              </span>
            )}
            {company.url && (
              <span className="inline-flex items-center gap-[5px] text-[13px] text-[#8fa3b8]">
                <span className="text-[#5a6a7a]"><GlobeIcon /></span>
                {company.url.replace('https://', '').replace('http://', '')}
              </span>
            )}
          </div>

          {/* Memo preview */}
          {hasMemo && company.memo && (
            <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 bg-[rgba(139,92,246,0.12)] rounded-[6px] text-[12px] text-[#c4b5fd] leading-[1.4]">
              <span className="flex-shrink-0 text-[#8b5cf6]"><MemoIcon /></span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {company.memo.length > 60 ? company.memo.substring(0, 60) + '...' : company.memo}
              </span>
            </div>
          )}
        </div>

        {/* Expand Button */}
        <button
          className="flex items-center justify-center w-9 h-9 rounded-[6px] border-none bg-transparent text-[#5a6a7a] cursor-pointer flex-shrink-0 self-center min-w-[44px] min-h-[44px] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#8fa3b8] transition-all"
          aria-label="詳細を展開"
          tabIndex={-1}
        >
          <span className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </button>
      </div>

      {/* Expanded Detail */}
      <div
        className={`overflow-hidden transition-[max-height] duration-300 ${expanded ? 'max-h-[1000px]' : 'max-h-0'}`}
        aria-hidden={!expanded}
      >
        <div className="px-[18px] pb-[18px] pl-[54px] flex flex-col gap-4">
          {/* Detail Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="bg-[#1a2235] rounded-[6px] p-3.5">
              <div className="text-[11px] font-semibold text-[#5a6a7a] uppercase tracking-[0.5px] mb-2.5">基本情報</div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">代表者名</span>
                <span className="text-[#8fa3b8]">{company.representativeName || '-'}</span>
              </div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">設立</span>
                <span className="text-[#8fa3b8]">{company.establishedYear ? `${company.establishedYear}年` : '-'}</span>
              </div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">従業員数</span>
                <span className="text-[#8fa3b8]">{company.employeeCount || '-'}</span>
              </div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">資本金</span>
                <span className="text-[#8fa3b8]">{company.capitalAmount || '-'}</span>
              </div>
              <div className="flex gap-2 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">事業内容</span>
                <span className="text-[#8fa3b8]">{company.businessDescription || '-'}</span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-[#1a2235] rounded-[6px] p-3.5">
              <div className="text-[11px] font-semibold text-[#5a6a7a] uppercase tracking-[0.5px] mb-2.5">連絡先</div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">電話</span>
                <span className="text-[#8fa3b8]">{company.phoneNumber || '-'}</span>
              </div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">メール</span>
                <span className="text-[#8fa3b8]">{company.email || '-'}</span>
              </div>
              <div className="flex gap-2 mb-1.5 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">URL</span>
                <span className="text-[#8fa3b8]">
                  {company.url ? (
                    <a href={company.url} target="_blank" rel="noopener" className="text-[#06C755] no-underline hover:underline">
                      {company.url.replace('https://', '').replace('http://', '')}
                    </a>
                  ) : '-'}
                </span>
              </div>
              <div className="flex gap-2 text-[13px]">
                <span className="text-[#5a6a7a] min-w-[80px] flex-shrink-0">依頼元</span>
                <span className="text-[#5a6a7a]">
                  {company.jobKeyword ? `"${company.jobKeyword}"` : '-'}
                  {company.jobCreatedAt && ` (${new Date(company.jobCreatedAt).toLocaleDateString('ja-JP')})`}
                </span>
              </div>
            </div>
          </div>

          {/* Memo Section */}
          <div className="bg-[#1a2235] rounded-[6px] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5a6a7a] uppercase tracking-[0.5px]">
                <MemoIcon /> メモ
              </div>
              {memoSaved && (
                <span className="text-[11px] text-[#5a6a7a] flex items-center gap-1">
                  <SaveCheckIcon /> 保存済み
                </span>
              )}
              {company.memoUpdatedAt && !memoSaved && (
                <span className="text-[11px] text-[#5a6a7a] flex items-center gap-1">
                  <SaveCheckIcon /> {company.memoUpdatedAt}
                </span>
              )}
            </div>
            <textarea
              className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.07)] rounded-[6px] text-[#f0f4f8] text-[13px] leading-[1.5] px-3 py-2.5 resize-y min-h-[70px] font-[inherit] transition-colors placeholder:text-[#5a6a7a] focus:border-[#06C755] focus:outline-none hover:border-[rgba(255,255,255,0.15)]"
              placeholder="メモを入力..."
              rows={3}
              value={memoText}
              onChange={(e) => handleMemoChange(e.target.value)}
              aria-label={`${company.companyName || company.domain}のメモ`}
            />
          </div>

          {/* Sent Content Section */}
          {company.sentAt && (company.sentSubject || company.sentMessageBody) && (
            <div className="bg-[rgba(6,199,85,0.05)] border border-[rgba(6,199,85,0.15)] rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5a6a7a] uppercase tracking-[0.5px] mb-2.5">
                <SendIcon /> 送信内容
                <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-[#5a6a7a]">
                  {new Date(company.sentAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {company.sentSubject && (
                <div className="mb-2">
                  <span className="text-[11px] text-[#5a6a7a] mr-2">件名:</span>
                  <span className="text-[#f0f4f8] font-semibold text-sm">{company.sentSubject}</span>
                </div>
              )}
              {company.sentMessageBody && (
                <div>
                  <span className="text-[11px] text-[#5a6a7a] block mb-1">本文:</span>
                  <div className={`text-[#8fa3b8] text-xs whitespace-pre-wrap ${!showFullMessage ? 'line-clamp-3' : ''}`}>
                    {company.sentMessageBody}
                  </div>
                  {company.sentMessageBody.split('\n').length > 3 || company.sentMessageBody.length > 200 ? (
                    <button
                      onClick={() => setShowFullMessage(!showFullMessage)}
                      className="text-[11px] text-[#06C755] mt-1 bg-transparent border-none cursor-pointer hover:underline font-[inherit] p-0"
                    >
                      {showFullMessage ? '折りたたむ' : '全文を見る'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold border transition-all min-h-[38px] cursor-pointer ${
                copied
                  ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                  : 'bg-[rgba(255,255,255,0.06)] text-[#8fa3b8] border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f0f4f8]'
              }`}
            >
              {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
              {copied ? 'コピーしました!' : '企業情報をコピー'}
            </button>

            {company.hasForm && (
              cooldown.inCooldown ? (
                <div className="flex flex-col gap-1">
                  <button
                    disabled
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold border-none bg-[#06C755] text-white min-h-[38px] opacity-40 cursor-not-allowed"
                  >
                    <SendIcon /> フォーム送信
                  </button>
                  <span className="text-[11px] text-[#5a6a7a]">
                    30日間のクールダウン中（{cooldown.cooldownEnd}以降に再送信可能）
                  </span>
                </div>
              ) : (
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold border-none bg-[#06C755] text-white min-h-[38px] cursor-pointer hover:bg-[#04a344] transition-all">
                  <SendIcon /> フォーム送信
                </button>
              )
            )}

            {company.url && (
              <a
                href={company.url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-[rgba(255,255,255,0.06)] text-[#8fa3b8] border border-[rgba(255,255,255,0.07)] min-h-[38px] no-underline cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f0f4f8] transition-all"
              >
                <ExternalLinkIcon /> サイトを開く
              </a>
            )}

            <button
              onClick={handleArchive}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-medium bg-[rgba(255,255,255,0.04)] text-[#5a6a7a] border border-[rgba(255,255,255,0.07)] min-h-[38px] cursor-pointer hover:text-[#ef4444] hover:border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.06)] transition-all"
            >
              <ArchiveIcon /> アーカイブ
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes cardFadeOut {
          0% { opacity: 1; transform: translateX(0); max-height: 300px; margin-bottom: 8px; }
          60% { opacity: 0; transform: translateX(30px); max-height: 300px; margin-bottom: 8px; }
          100% { opacity: 0; transform: translateX(30px); max-height: 0; margin-bottom: 0; overflow: hidden; }
        }
        .animate-card-fade-out {
          animation: cardFadeOut 400ms ease-out forwards;
        }
      `}</style>
    </div>
  )
}
