export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CancelButton from './CancelButton'
import NewRequestButton from './NewRequestButton'

function getStatusBadge(job: { status: string; confirmedAt: Date | null }) {
  if (job.status === 'completed' && job.confirmedAt) {
    return { label: '確定済み(送信可能)', color: 'text-blue-400 bg-blue-900/30' }
  }
  if (job.status === 'completed') {
    return { label: '収集完了(未確定)', color: 'text-[#06C755] bg-[rgba(6,199,85,0.1)]' }
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

export default async function MyListsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/my-lists')
  }

  const lineUsers = await prisma.lineUser.findMany({
    where: { userId: session.user.id },
    include: {
      jobs: {
        orderBy: { createdAt: 'desc' },
        include: {
          urls: {
            select: { hasForm: true, companyVerified: true, excluded: true },
          },
          _count: {
            select: {
              urls: { where: { excluded: true } },
            },
          },
        },
      },
    },
  })

  const jobs = lineUsers.flatMap((u) => u.jobs).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">マイリスト</h1>
          <p className="text-sm text-[#8fa3b8]">フォーム営業リストの一覧です</p>
        </div>
        <NewRequestButton />
      </div>

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
          <p className="text-sm text-[#4a6080] mb-6">
            業種と地域を指定して、フォーム営業リストを作成しましょう
          </p>
          <NewRequestButton />
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const formCount = job.urls.filter((u) => u.hasForm && u.companyVerified).length
            const status = getStatusBadge(job)
            // failedジョブでも収集済みデータがあれば部分納品として閲覧可能にする
            const isPartialDelivery = job.status === 'failed' && formCount > 0
            // 収集数はDB上の実レコード数を使う（totalFoundはジョブ完了時の値で除外後にずれる場合がある）
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
                    <span className="text-xs text-[#4a6080]">
                      {new Date(job.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <h2 className="text-[#f0f4f8] font-medium mb-1">{job.keyword}</h2>
                  <div className="flex items-center gap-2 flex-wrap text-sm text-[#8fa3b8]">
                    {job.industry && <span>{job.industry}</span>}
                    {job.location && <span>{job.location}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#4a6080] mt-1">
                    <span>依頼: <span className="text-[#f0f4f8]">{job.targetCount}件</span></span>
                    <span className="text-[#4a6080]">→</span>
                    <span>収集: <span className="text-[#f0f4f8]">{actualCollected}件</span></span>
                    <span className="text-[#4a6080]">→</span>
                    <span>確定: <span className="text-[#f0f4f8]">{confirmedCount !== null ? `${confirmedCount}件` : '-'}</span></span>
                  </div>
                  {job.completedAt && (
                    <p className="text-xs text-[#4a6080] mt-1">
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
                        リストを見る →
                      </Link>
                      {job.confirmedAt && (
                        <Link
                          href={`/send/${job.id}`}
                          className="border border-blue-400/50 text-blue-400 hover:bg-blue-400/10 text-sm font-bold px-5 py-2 rounded-full transition-all whitespace-nowrap"
                        >
                          フォーム送信 →
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
