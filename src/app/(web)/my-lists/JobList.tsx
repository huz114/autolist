'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import CancelButton from './CancelButton'

// -- Types --

interface UrlInfo {
  hasForm: boolean
  companyVerified: boolean
  excluded: boolean
}

export interface Job {
  id: string
  status: string
  keyword: string
  industry: string | null
  location: string | null
  targetCount: number
  totalFound: number
  createdAt: string
  completedAt: string | null
  confirmedAt: string | null
  urls: UrlInfo[]
  _count: { urls: number }
}

interface JobListProps {
  initialJobs: Job[]
}

// -- Helpers --

const PROCESSING_STATUSES = ['pending', 'running', 'processing']

function hasProcessingJobs(jobs: Job[]): boolean {
  return jobs.some((j) => PROCESSING_STATUSES.includes(j.status))
}

function getStatusBadge(job: { status: string; confirmedAt: string | null }) {
  if (job.status === 'completed') {
    return { label: '収集完了', color: 'text-[#06C755] bg-[rgba(6,199,85,0.1)]' }
  }
  const map: Record<string, { label: string; color: string }> = {
    pending:    { label: '処理中', color: 'text-amber-400 bg-amber-900/30' },
    running:    { label: '処理中', color: 'text-amber-400 bg-amber-900/30' },
    processing: { label: '処理中', color: 'text-amber-400 bg-amber-900/30' },
    failed:     { label: 'エラー', color: 'text-[#ff4757] bg-[rgba(255,71,87,0.1)]' },
    cancelled:  { label: 'キャンセル', color: 'text-[#8fa3b8] bg-[#0d1526]' },
  }
  return map[job.status] ?? { label: job.status, color: 'text-[#8fa3b8] bg-[#0d1526]' }
}

// -- Toast Component --

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      className="toast-slide-in fixed bottom-6 right-6 z-[100] max-w-sm cursor-pointer"
    >
      <div className="bg-[#111827] border border-[rgba(6,199,85,0.4)] rounded-xl px-5 py-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <p className="text-sm text-[#f0f4f8]">{message}</p>
      </div>
      <style jsx>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .toast-slide-in {
          animation: toast-slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// -- Main Component --

export default function JobList({ initialJobs }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([])
  const prevJobsRef = useRef<Map<string, string>>(new Map())
  const isVisibleRef = useRef(true)

  // Sync when initialJobs changes (e.g. after router.refresh())
  useEffect(() => {
    setJobs(initialJobs)
    const map = new Map<string, string>()
    initialJobs.forEach((j) => map.set(j.id, j.status))
    prevJobsRef.current = map
  }, [initialJobs])

  // Track page visibility
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Show toast
  const addToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Polling
  useEffect(() => {
    if (!hasProcessingJobs(jobs)) return

    const poll = async () => {
      if (!isVisibleRef.current) return

      try {
        const res = await fetch('/api/jobs')
        if (!res.ok) return
        const data = await res.json()
        const newJobs: Job[] = data.jobs

        // Detect completions for toast
        newJobs.forEach((newJob) => {
          const prevStatus = prevJobsRef.current.get(newJob.id)
          if (
            prevStatus &&
            PROCESSING_STATUSES.includes(prevStatus) &&
            newJob.status === 'completed'
          ) {
            addToast(`${newJob.keyword}のリスト収集が完了しました`)
          }
        })

        // Update prev status map
        const map = new Map<string, string>()
        newJobs.forEach((j) => map.set(j.id, j.status))
        prevJobsRef.current = map

        setJobs(newJobs)
      } catch {
        // Silently ignore fetch errors
      }
    }

    const intervalId = setInterval(poll, 5000)
    return () => clearInterval(intervalId)
  }, [jobs, addToast])

  // Empty state
  if (jobs.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job) => {
          const formCount = job.urls.filter((u) => u.hasForm && u.companyVerified).length
          const status = getStatusBadge(job)
          const isPartialDelivery = job.status === 'failed' && formCount > 0
          const actualCollected = job.urls.length
          const excludedCount = job._count.urls
          const confirmedCount = job.confirmedAt ? actualCollected - excludedCount : null

          return (
            <div
              key={job.id}
              className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:border-[rgba(6,199,85,0.4)]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-[#8494a7]">
                    {new Date(job.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <h2 className="text-[#f0f4f8] font-medium mb-1">{job.keyword}</h2>
                <div className="flex items-center gap-2 flex-wrap text-sm text-[#8fa3b8]">
                  {job.industry && <span>{job.industry}</span>}
                  {job.location && <span>{job.location}</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-[#8494a7] mt-1">
                  <span>依頼: <span className="text-[#f0f4f8]">{job.targetCount}件</span></span>
                  <span className="text-[#8494a7]">&rarr;</span>
                  <span>収集: <span className="text-[#f0f4f8]">{actualCollected}件</span></span>
                </div>
                {job.completedAt && (
                  <p className="text-xs text-[#8494a7] mt-1">
                    完了: {new Date(job.completedAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {(job.status === 'running' || job.status === 'pending') && (
                  <CancelButton jobId={job.id} />
                )}
                {(job.status === 'completed' || isPartialDelivery) && formCount > 0 && (
                  <>
                    {isPartialDelivery && (
                      <span className="text-xs text-amber-400">
                        {formCount}件収集済み（部分納品）
                      </span>
                    )}
                    <Link
                      href={`/autolist-results/${job.id}`}
                      className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-5 py-2 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] whitespace-nowrap"
                    >
                      リストを見る &rarr;
                    </Link>
                    {job.confirmedAt && (
                      <Link
                        href={`/send/${job.id}`}
                        className="border border-blue-400/50 text-blue-400 hover:bg-blue-400/10 text-sm font-bold px-5 py-2 rounded-full transition-all whitespace-nowrap"
                      >
                        フォーム送信 &rarr;
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Toasts */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </>
  )
}
