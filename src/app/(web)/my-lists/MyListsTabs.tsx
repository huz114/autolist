'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import JobList from './JobList'
import type { Job } from './JobList'
import UnifiedCompanyList from './UnifiedCompanyList'
import NewRequestButton from './NewRequestButton'
import SendHistoryTab from './SendHistoryTab'

type TabType = 'companies' | 'jobs' | 'send-history'

interface MyListsTabsProps {
  jobs: Job[]
  sendCount?: number
}

export default function MyListsTabs({ jobs, sendCount }: MyListsTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabType>(
    tabParam === 'jobs' ? 'jobs' : tabParam === 'send-history' ? 'send-history' : 'companies'
  )

  // Sync tab with URL param on mount
  useEffect(() => {
    if (tabParam === 'jobs') setActiveTab('jobs')
    else if (tabParam === 'send-history') setActiveTab('send-history')
  }, [tabParam])

  // 進行中ジョブの追跡（常時ポーリング）
  const [runningJobs, setRunningJobs] = useState<Array<{ id: string; keyword: string; targetCount: number; totalFound: number; status: string }>>([])

  useEffect(() => {
    const fetchRunning = async () => {
      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) return
        const data = await res.json()
        const allJobs = data.jobs || []
        setRunningJobs(allJobs.filter((j: any) => ['pending', 'running', 'processing'].includes(j.status)))
      } catch {}
    }
    fetchRunning()

    const interval = setInterval(fetchRunning, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* SP: PC案内バナー */}
      <div className="sm:hidden mb-4 bg-[#111827] border border-[rgba(6,199,85,0.2)] rounded-[10px] px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-[#06C755] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-[12px] text-[#8fa3b8] leading-relaxed">
          <span className="text-[#f0f4f8] font-medium">フォーム一括送信はPCから</span>ご利用いただけます。リストの確認・CSVダウンロードはスマホでも可能です。
        </p>
      </div>

      {/* 進行中のジョブ */}
      {runningJobs.length > 0 && (
        <div className="mb-4 space-y-2">
          {runningJobs.map(job => (
            <div key={job.id} className="bg-[#111827] border border-[rgba(245,158,11,0.3)] rounded-[10px] px-4 py-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-[#f59e0b] animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#f0f4f8] font-medium truncate">
                  {`「${job.keyword}」を収集中...`}
                </p>
                <p className="text-[11px] text-[#8fa3b8] tabular-nums">
                  {job.totalFound}/{job.targetCount}件
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-[2px] border-b border-[rgba(255,255,255,0.07)] mb-5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 px-5 py-3 border-none bg-transparent text-[14px] font-semibold cursor-pointer border-b-2 transition-colors min-h-[44px] font-[inherit] whitespace-nowrap ${
            activeTab === 'companies'
              ? 'text-[#06C755] border-b-[#06C755]'
              : 'text-[#8fa3b8] border-b-transparent hover:text-[#f0f4f8]'
          }`}
          role="tab"
          aria-selected={activeTab === 'companies'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          企業一覧
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-5 py-3 border-none bg-transparent text-[14px] font-semibold cursor-pointer border-b-2 transition-colors min-h-[44px] font-[inherit] whitespace-nowrap ${
            activeTab === 'jobs'
              ? 'text-[#06C755] border-b-[#06C755]'
              : 'text-[#8fa3b8] border-b-transparent hover:text-[#f0f4f8]'
          }`}
          role="tab"
          aria-selected={activeTab === 'jobs'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          依頼履歴
          <span className={`px-2 py-[2px] rounded-full text-[12px] font-semibold tabular-nums ${
            activeTab === 'jobs'
              ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755]'
              : 'bg-[rgba(255,255,255,0.06)]'
          }`}>
            {jobs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('send-history')}
          className={`flex items-center gap-2 px-5 py-3 border-none bg-transparent text-[14px] font-semibold cursor-pointer border-b-2 transition-colors min-h-[44px] font-[inherit] whitespace-nowrap ${
            activeTab === 'send-history'
              ? 'text-[#06C755] border-b-[#06C755]'
              : 'text-[#8fa3b8] border-b-transparent hover:text-[#f0f4f8]'
          }`}
          role="tab"
          aria-selected={activeTab === 'send-history'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13"/>
            <path d="M22 2 15 22 11 13 2 9z"/>
          </svg>
          フォーム送信履歴
          {typeof sendCount === 'number' && (
            <span className={`px-2 py-[2px] rounded-full text-[12px] font-semibold tabular-nums ${
              activeTab === 'send-history'
                ? 'bg-[rgba(6,199,85,0.15)] text-[#06C755]'
                : 'bg-[rgba(255,255,255,0.06)]'
            }`}>
              {sendCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'companies' && (
        <UnifiedCompanyList initialJobs={jobs} />
      )}

      {activeTab === 'jobs' && (
        <>
          {jobs.length === 0 ? (
            <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#06C755]">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-[#f0f4f8] font-medium mb-2">まだリストがありません</p>
              <p className="text-sm text-[#8494a7] mb-6">
                業種と地域を指定して、営業リストを作成しましょう
              </p>
              <NewRequestButton />
            </div>
          ) : (
            <JobList initialJobs={jobs} />
          )}
        </>
      )}

      {activeTab === 'send-history' && (
        <SendHistoryTab />
      )}
    </>
  )
}
