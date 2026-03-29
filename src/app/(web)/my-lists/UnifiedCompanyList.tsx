'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CompanyCard, { type Company } from './CompanyCard'
import { INDUSTRY_MAJOR_LIST } from '@/lib/industry-master'

/** 政令指定都市 → 都道府県マッピング (JSON.parseでSWC minifyの識別子化を防止) */
const CITY_TO_PREFECTURE: Record<string, string> = JSON.parse('{"札幌市":"北海道","仙台市":"宮城県","さいたま市":"埼玉県","千葉市":"千葉県","横浜市":"神奈川県","川崎市":"神奈川県","相模原市":"神奈川県","新潟市":"新潟県","静岡市":"静岡県","浜松市":"静岡県","名古屋市":"愛知県","京都市":"京都府","大阪市":"大阪府","堺市":"大阪府","神戸市":"兵庫県","岡山市":"岡山県","広島市":"広島県","北九州市":"福岡県","福岡市":"福岡県","熊本市":"熊本県"}')

/** 住所文字列から都道府県を抽出（政令指定都市からの推定対応） */
function extractPrefecture(address: string): string | null {
  // 1. 正規表現で都道府県を直接抽出
  const m = address.match(/(北海道|東京都|大阪府|京都府|.{2,3}県)/)
  if (m) return m[1]
  // 2. 政令指定都市名から都道府県を推定
  for (const city of Object.keys(CITY_TO_PREFECTURE)) {
    if (address.startsWith(city)) return CITY_TO_PREFECTURE[city]
  }
  return null
}

// -- Types --

type StatusFilter = 'all' | 'unsent' | 'sent' | 'dl' | 'hasPhone'
type StatFilter = 'all' | 'hasForm' | 'sent' | 'downloaded'

// -- Icons --

const SearchIcon = () => (
  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6a7a] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2 11 13"/>
    <path d="M22 2 15 22 11 13 2 9z"/>
  </svg>
)

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

// -- Component --

export default function UnifiedCompanyList() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [statFilter, setStatFilter] = useState<StatFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [hasPhoneFilter, setHasPhoneFilter] = useState(false)
  const [memoFilter, setMemoFilter] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [jobFilter, setJobFilter] = useState<string>('all')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Ref for select all checkbox
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies')
        if (!res.ok) throw new Error('企業データの取得に失敗しました')
        const data = await res.json()
        setCompanies(data.companies || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '企業データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    fetchCompanies()
  }, [])

  // 都道府県順ソート用定数
  const PREF_ORDER = useMemo(() => [
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県',
    '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
  ], [])

  /** ジョブフィルター条件に合致するか */
  const matchesJob = useCallback((c: Company, filter: string) => {
    if (filter === 'all') return true
    const keyword = c.sourceJob || c.jobKeyword
    const date = c.sourceDate || c.jobCreatedAt
    return `${keyword || ''}__${date || ''}` === filter
  }, [])

  /** 業種フィルター条件に合致するか */
  const matchesIndustry = useCallback((c: Company, filter: string) => {
    if (filter === 'all') return true
    if (filter === '__unclassified__') return !c.industryMajor || c.industryMajor === ''
    return c.industryMajor === filter
  }, [])

  /** 地域フィルター条件に合致するか */
  const matchesLocation = useCallback((c: Company, filter: string) => {
    if (filter === 'all') return true
    const pref = c.location ? extractPrefecture(c.location) : null
    return pref === filter
  }, [])

  /** 都道府県セットからソート済み配列を生成 */
  const sortPrefectures = useCallback((prefSet: Set<string>) => {
    const sorted = PREF_ORDER.filter(p => prefSet.has(p))
    const remaining = Array.from(prefSet).filter(p => !PREF_ORDER.includes(p)).sort()
    sorted.push(...remaining)
    return sorted
  }, [PREF_ORDER])

  // Compute filter options with cross-filter dependency
  const { industries, prefectures, jobOptions } = useMemo(() => {
    // 業種の選択肢: 地域・依頼ジョブフィルター適用後の企業から生成
    const industriesFiltered = companies.filter(c =>
      matchesLocation(c, locationFilter) && matchesJob(c, jobFilter)
    )
    const majorSet = new Set<string>()
    let hasUnclassified = false
    industriesFiltered.forEach(c => {
      if (c.industryMajor) majorSet.add(c.industryMajor)
      else hasUnclassified = true
    })
    const industries = INDUSTRY_MAJOR_LIST.filter(m => majorSet.has(m))
    if (hasUnclassified) industries.push('__unclassified__')

    // 地域の選択肢: 業種・依頼ジョブフィルター適用後の企業から生成
    const locationFiltered = companies.filter(c =>
      matchesIndustry(c, industryFilter) && matchesJob(c, jobFilter)
    )
    const prefSet = new Set<string>()
    locationFiltered.forEach(c => {
      if (c.location) {
        const pref = extractPrefecture(c.location)
        if (pref) prefSet.add(pref)
      }
    })
    const prefectures = sortPrefectures(prefSet)

    // 依頼ジョブの選択肢: 業種・地域フィルター適用後の企業から生成
    const jobFiltered = companies.filter(c =>
      matchesIndustry(c, industryFilter) && matchesLocation(c, locationFilter)
    )
    const jobMap = new Map<string, { keyword: string; date: string }>()
    jobFiltered.forEach(c => {
      const keyword = c.sourceJob || c.jobKeyword
      const date = c.sourceDate || c.jobCreatedAt
      if (keyword) {
        const key = `${keyword}__${date || ''}`
        if (!jobMap.has(key)) {
          jobMap.set(key, { keyword, date: date || '' })
        }
      }
    })
    const jobOptions = Array.from(jobMap.values()).sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date)
      if (a.date) return -1
      if (b.date) return 1
      return a.keyword.localeCompare(b.keyword)
    })

    return { industries, prefectures, jobOptions }
  }, [companies, industryFilter, locationFilter, jobFilter, matchesIndustry, matchesLocation, matchesJob, sortPrefectures])

  // Stats
  const stats = useMemo(() => {
    const nonArchived = companies.filter(c => !c.isArchived)
    return {
      total: nonArchived.length,
      hasForm: nonArchived.filter(c => c.hasForm).length,
      sent: nonArchived.filter(c => !!c.sentAt).length,
      downloaded: nonArchived.filter(c => !!c.downloadedAt).length,
    }
  }, [companies])

  // Filtered and sorted companies
  const filteredCompanies = useMemo(() => {
    let result = companies.filter(c => {
      // Archive filter
      if (showArchived && !c.isArchived) return false
      if (!showArchived && c.isArchived) return false

      // Stat filter (quick filter from stats bar)
      if (statFilter === 'hasForm' && !c.hasForm) return false
      if (statFilter === 'sent' && !c.sentAt) return false
      if (statFilter === 'downloaded' && !c.downloadedAt) return false

      // Status filter
      if (statusFilter === 'unsent' && (!c.hasForm || c.sentAt)) return false
      if (statusFilter === 'sent' && !c.sentAt) return false
      if (statusFilter === 'dl' && !c.downloadedAt) return false

      // HasPhone filter
      if (hasPhoneFilter && (!c.phoneNumber || c.phoneNumber === '記載なし')) return false

      // Memo filter
      if (memoFilter && !c.memo) return false

      // Industry filter (大分類ベース)
      if (industryFilter !== 'all') {
        if (industryFilter === '__unclassified__') {
          if (c.industryMajor && c.industryMajor !== '') return false
        } else if (c.industryMajor !== industryFilter) return false
      }

      // Location filter (都道府県ベース)
      if (locationFilter !== 'all') {
        const pref = c.location ? extractPrefecture(c.location) : null
        if (pref !== locationFilter) return false
      }

      // Job filter
      if (jobFilter !== 'all') {
        const keyword = c.sourceJob || c.jobKeyword
        const date = c.sourceDate || c.jobCreatedAt
        const jobKey = `${keyword || ''}__${date || ''}`
        if (jobKey !== jobFilter) return false
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = (c.companyName || '').toLowerCase()
        const memo = (c.memo || '').toLowerCase()
        const domain = (c.domain || '').toLowerCase()
        if (!name.includes(q) && !memo.includes(q) && !domain.includes(q)) return false
      }

      return true
    })

    // Sort: pinned first
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

    return result
  }, [companies, statFilter, statusFilter, hasPhoneFilter, memoFilter, showArchived, industryFilter, locationFilter, jobFilter, searchQuery])

  // Update select all checkbox state
  useEffect(() => {
    if (!selectAllRef.current) return
    const visibleIds = new Set(filteredCompanies.map(c => c.id))
    const selectedVisible = Array.from(selectedIds).filter(id => visibleIds.has(id)).length
    if (selectedVisible === 0) {
      selectAllRef.current.checked = false
      selectAllRef.current.indeterminate = false
    } else if (selectedVisible === filteredCompanies.length) {
      selectAllRef.current.checked = true
      selectAllRef.current.indeterminate = false
    } else {
      selectAllRef.current.checked = false
      selectAllRef.current.indeterminate = true
    }
  }, [selectedIds, filteredCompanies])

  // Handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [filteredCompanies])

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handlePinToggle = useCallback(async (id: string) => {
    // Optimistic update
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    ))
    try {
      await fetch(`/api/companies/${id}/pin`, { method: 'POST' })
    } catch {
      // Revert on error
      setCompanies(prev => prev.map(c =>
        c.id === id ? { ...c, isPinned: !c.isPinned } : c
      ))
    }
  }, [])

  const handleArchive = useCallback(async (id: string) => {
    const target = companies.find(c => c.id === id)
    const newArchived = !target?.isArchived
    // Optimistic update
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, isArchived: newArchived } : c
    ))
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    try {
      await fetch(`/api/companies/${id}/archive`, { method: 'POST' })
    } catch {
      // Revert on error
      setCompanies(prev => prev.map(c =>
        c.id === id ? { ...c, isArchived: !newArchived } : c
      ))
    }
  }, [companies])

  const handleMemoSave = useCallback(async (id: string, memo: string) => {
    // Optimistic update
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, memo, memoUpdatedAt: new Date().toLocaleString('ja-JP') } : c
    ))
    try {
      await fetch(`/api/companies/${id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      })
    } catch {
      // Silent fail
    }
  }, [])

  const handleStatFilter = useCallback((filter: StatFilter) => {
    setStatFilter(prev => prev === filter ? 'all' : filter)
  }, [])

  const selectedCompanies = filteredCompanies.filter(c => selectedIds.has(c.id))
  const selectedCount = selectedCompanies.length
  const cooldownMs = 30 * 24 * 60 * 60 * 1000
  const sendableCompanies = selectedCompanies.filter(c =>
    c.hasForm && c.formUrl &&
    (!c.sentAt || (Date.now() - new Date(c.sentAt).getTime()) >= cooldownMs)
  )
  const sendableCount = sendableCompanies.length
  const noFormCount = selectedCompanies.filter(c => !c.hasForm || !c.formUrl).length
  const cooldownCount = selectedCompanies.filter(c => c.hasForm && c.formUrl && c.sentAt && (Date.now() - new Date(c.sentAt).getTime()) < cooldownMs).length

  const handleCsvDownload = useCallback(async () => {
    if (selectedCompanies.length === 0) return
    const escapeField = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }
    const headers = ['企業名','業種','業種大分類','所在地','URL','電話番号','メールアドレス','代表者名','設立年','従業員数','資本金','事業内容','フォームURL','フォームあり']
    const rows = selectedCompanies.map(c => [
      c.companyName || c.domain,
      c.industry ?? '',
      c.industryMajor ?? '',
      c.location ?? '',
      c.url,
      c.phoneNumber ?? '',
      c.email ?? '',
      c.representativeName ?? '',
      c.establishedYear != null ? String(c.establishedYear) : '',
      c.employeeCount ?? '',
      c.capitalAmount ?? '',
      c.businessDescription ?? '',
      c.formUrl ?? '',
      c.hasForm ? 'あり' : 'なし',
    ].map(escapeField).join(','))
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `autolist_${date}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    // downloadedAtを記録
    const ids = selectedCompanies.map(c => c.id)
    try {
      await fetch('/api/companies/download-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      setCompanies(prev => prev.map(c =>
        ids.includes(c.id) ? { ...c, downloadedAt: new Date().toISOString() } : c
      ))
    } catch { /* ignore */ }
  }, [selectedCompanies])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-6 w-6 text-[#06C755]" viewBox="0 0 24 24" role="status" aria-label="読み込み中">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-[#8fa3b8] text-sm">企業データを読み込み中...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-3">
        <p className="text-[#ff4757] text-sm">{error}</p>
      </div>
    )
  }

  // Empty state
  if (companies.length === 0) {
    return (
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
          <UsersIcon />
        </div>
        <p className="text-[#f0f4f8] font-medium mb-2">まだ企業データがありません</p>
        <p className="text-sm text-[#8494a7]">
          リストを依頼すると、収集された企業がここに表示されます
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {([
          { key: 'all' as StatFilter, label: '全企業', value: stats.total },
          { key: 'hasForm' as StatFilter, label: 'フォームあり', value: stats.hasForm },
          { key: 'sent' as StatFilter, label: 'フォーム送信済み', value: stats.sent },
          { key: 'downloaded' as StatFilter, label: 'CSVダウンロード済', value: stats.downloaded },
        ]).map(({ key, label, value }) => (
          <button
            key={key}
            onClick={() => handleStatFilter(key)}
            className={`bg-[#111827] border rounded-[10px] px-4 py-3.5 text-left cursor-pointer transition-all min-h-[44px] ${
              statFilter === key
                ? 'border-[rgba(6,199,85,0.4)] bg-[rgba(6,199,85,0.05)]'
                : 'border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] hover:bg-[#151d2e]'
            }`}
          >
            <div className="text-[12px] text-[#5a6a7a] font-medium mb-1">{label}</div>
            <div className={`text-[22px] font-bold tabular-nums ${statFilter === key ? 'text-[#06C755]' : 'text-[#f0f4f8]'}`}>
              {value}
            </div>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[14px] px-5 py-4 mb-4 flex flex-col gap-3">
        {/* Row 1: Industry & Location */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-[#5a6a7a] shrink-0 whitespace-nowrap">業種</span>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="flex-1 min-w-0 appearance-none bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[6px] text-[#8fa3b8] text-[13px] py-[7px] pl-3 pr-8 font-[inherit] cursor-pointer min-h-[36px] transition-colors hover:border-[rgba(255,255,255,0.2)] focus-visible:outline-2 focus-visible:outline-[#06C755] focus-visible:outline-offset-1 bg-no-repeat bg-[right_10px_center] bg-[length:12px_12px]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238fa3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
            }}
            aria-label="業種フィルタ"
          >
            <option value="all">全て</option>
            {industries.map(i => <option key={i} value={i}>{i === '__unclassified__' ? '未分類' : i}</option>)}
          </select>

          <span className="text-[12px] font-semibold text-[#5a6a7a] shrink-0 whitespace-nowrap">地域</span>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="flex-1 min-w-0 appearance-none bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[6px] text-[#8fa3b8] text-[13px] py-[7px] pl-3 pr-8 font-[inherit] cursor-pointer min-h-[36px] transition-colors hover:border-[rgba(255,255,255,0.2)] focus-visible:outline-2 focus-visible:outline-[#06C755] focus-visible:outline-offset-1 bg-no-repeat bg-[right_10px_center] bg-[length:12px_12px]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238fa3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
            }}
            aria-label="地域フィルタ"
          >
            <option value="all">全て</option>
            {prefectures.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <span className="text-[12px] font-semibold text-[#5a6a7a] shrink-0 whitespace-nowrap">依頼ジョブ</span>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="flex-1 min-w-0 appearance-none bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[6px] text-[#8fa3b8] text-[13px] py-[7px] pl-3 pr-8 font-[inherit] cursor-pointer min-h-[36px] transition-colors hover:border-[rgba(255,255,255,0.2)] focus-visible:outline-2 focus-visible:outline-[#06C755] focus-visible:outline-offset-1 bg-no-repeat bg-[right_10px_center] bg-[length:12px_12px]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238fa3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
            }}
            aria-label="依頼ジョブフィルタ"
          >
            <option value="all">全て</option>
            {jobOptions.map(j => {
              const key = `${j.keyword}__${j.date}`
              const dateLabel = j.date ? ` (${new Date(j.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })})` : ''
              return <option key={key} value={key}>{j.keyword}{dateLabel}</option>
            })}
          </select>
        </div>

        {/* Row 2: Status pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-semibold text-[#5a6a7a] min-w-[70px] whitespace-nowrap">ステータス</span>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'all' as StatusFilter, label: '全て' },
              { key: 'unsent' as StatusFilter, label: 'フォーム未送信' },
              { key: 'sent' as StatusFilter, label: 'フォーム送信済み' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium border cursor-pointer transition-all min-h-[36px] select-none ${
                  statusFilter === key
                    ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                    : 'bg-[rgba(255,255,255,0.05)] text-[#8fa3b8] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-[#f0f4f8]'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setHasPhoneFilter(prev => !prev)}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium border cursor-pointer transition-all min-h-[36px] select-none ${
                hasPhoneFilter
                  ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                  : 'bg-[rgba(255,255,255,0.05)] text-[#8fa3b8] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-[#f0f4f8]'
              }`}
            >
              電話番号あり
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'dl' ? 'all' : 'dl')}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium border cursor-pointer transition-all min-h-[36px] select-none ${
                statusFilter === 'dl'
                  ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                  : 'bg-[rgba(255,255,255,0.05)] text-[#8fa3b8] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-[#f0f4f8]'
              }`}
            >
              CSVダウンロード済
            </button>
          </div>
        </div>

        {/* Row 3: Misc filters + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setMemoFilter(prev => !prev)}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium border cursor-pointer transition-all min-h-[36px] select-none ${
                memoFilter
                  ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                  : 'bg-[rgba(255,255,255,0.05)] text-[#8fa3b8] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-[#f0f4f8]'
              }`}
            >
              メモあり
            </button>
            <button
              onClick={() => setShowArchived(prev => !prev)}
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-medium border cursor-pointer transition-all min-h-[36px] select-none ${
                showArchived
                  ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755] border-[rgba(6,199,85,0.4)]'
                  : 'bg-[rgba(255,255,255,0.05)] text-[#8fa3b8] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-[#f0f4f8]'
              }`}
            >
              アーカイブ済みを表示
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="企業名・メモで検索..."
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[6px] text-[#f0f4f8] text-[13px] py-2 pl-9 pr-3 font-[inherit] min-h-[36px] transition-colors placeholder:text-[#5a6a7a] hover:border-[rgba(255,255,255,0.2)] focus:border-[#06C755] focus:outline-none"
              aria-label="企業検索"
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-[10px] mb-4 sticky top-[56px] z-10 flex-wrap">
        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
          <input
            ref={selectAllRef}
            type="checkbox"
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-[18px] h-[18px] accent-[#06C755] cursor-pointer"
            aria-label="全て選択"
          />
          <span className="text-[13px] text-[#8fa3b8] font-medium">全選択</span>
        </label>
        <span className="text-[13px] text-[#06C755] font-semibold tabular-nums ml-auto">
          {selectedCount}件選択中
        </span>
        <div className="flex gap-2">
          <button
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-[rgba(255,255,255,0.06)] text-[#8fa3b8] border border-[rgba(255,255,255,0.07)] min-h-[38px] cursor-pointer hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f0f4f8] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="CSVダウンロード"
            onClick={handleCsvDownload}
          >
            <DownloadIcon /> CSVダウンロード
          </button>
          <div className="relative">
            <button
              disabled={selectedCount === 0 || sendableCount === 0}
              onClick={() => {
                const excluded: string[] = []
                if (noFormCount > 0) excluded.push(`フォームなし${noFormCount}件`)
                if (cooldownCount > 0) excluded.push(`クールダウン中${cooldownCount}件`)
                if (excluded.length > 0) {
                  const ok = confirm(`選択中の${selectedCount}件のうち${excluded.join('・')}を除外し、${sendableCount}件に送信します。よろしいですか？`)
                  if (!ok) return
                }
                router.push(`/send/bulk?ids=${sendableCompanies.map(c => c.id).join(',')}`)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-[#06C755] text-white border-none min-h-[38px] cursor-pointer hover:bg-[#04a344] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="フォーム送信"
            >
              <SendIcon /> フォーム送信{sendableCount > 0 && selectedCount !== sendableCount ? ` (${sendableCount}件)` : ''}
            </button>
            {selectedCount > 0 && sendableCount === 0 && (
              <p className="absolute top-full right-0 mt-1 text-[11px] text-[#f59e0b] whitespace-nowrap text-right">
                送信可能な企業がありません
                {noFormCount > 0 && cooldownCount > 0
                  ? `（フォームなし${noFormCount}件・送信後30日以内${cooldownCount}件）`
                  : noFormCount > 0
                  ? `（フォームが検出されていません）`
                  : cooldownCount > 0
                  ? `（前回送信から30日以内のため送信制限中）`
                  : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Display Count */}
      <div className="text-[13px] text-[#5a6a7a] mb-3 tabular-nums">
        表示: <strong className="text-[#8fa3b8] font-semibold">{filteredCompanies.length}</strong> / {stats.total}件
      </div>

      {/* Company Card List */}
      <div className="flex flex-col gap-2">
        {filteredCompanies.map(company => (
          <CompanyCard
            key={company.id}
            company={company}
            selected={selectedIds.has(company.id)}
            onSelect={handleSelect}
            onPinToggle={handlePinToggle}
            onArchive={handleArchive}
            onMemoSave={handleMemoSave}
          />
        ))}
      </div>

      {filteredCompanies.length === 0 && companies.length > 0 && (
        <div className="text-center py-12 text-[#5a6a7a] text-sm">
          条件に一致する企業が見つかりません
        </div>
      )}
    </div>
  )
}
