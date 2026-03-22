export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CancelButton from './CancelButton'
import NewRequestButton from './NewRequestButton'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: '待機中',   color: 'text-gray-400 bg-gray-800' },
  running:    { label: '収集中',   color: 'text-blue-400 bg-blue-900/30' },
  processing: { label: '収集中',   color: 'text-blue-400 bg-blue-900/30' },
  completed:  { label: '完了',     color: 'text-emerald-400 bg-emerald-900/30' },
  failed:     { label: '失敗',     color: 'text-red-400 bg-red-900/30' },
  cancelled:  { label: 'キャンセル', color: 'text-gray-400 bg-gray-800' },
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
            select: { hasForm: true, companyVerified: true },
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
          <h1 className="text-2xl font-bold text-white mb-1">マイリスト</h1>
          <p className="text-sm text-gray-400">フォーム営業リストの一覧です</p>
        </div>
        <NewRequestButton />
      </div>

      {jobs.length === 0 ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-gray-400 mb-4">まだリストがありません</p>
          <p className="text-sm text-gray-500">
            LINEでオートリストにメッセージを送って、営業リストを作成してください
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const formCount = job.urls.filter((u) => u.hasForm && u.companyVerified).length
            const status = STATUS_LABEL[job.status] ?? { label: job.status, color: 'text-gray-400 bg-gray-800' }
            // failedジョブでも収集済みデータがあれば部分納品として閲覧可能にする
            const isPartialDelivery = job.status === 'failed' && formCount > 0

            return (
              <div
                key={job.id}
                className="bg-[#16161f] border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(job.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <h2 className="text-white font-medium mb-1">{job.keyword}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    {job.industry && <span>{job.industry}</span>}
                    {job.location && <span>{job.location}</span>}
                    <span>収集: <span className="text-white">{job.totalFound}件</span></span>
                  </div>
                  {job.completedAt && (
                    <p className="text-xs text-gray-600 mt-1">
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
                        className="bg-[#06C755] hover:bg-[#05b34a] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
                      >
                        リストを見る →
                      </Link>
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
