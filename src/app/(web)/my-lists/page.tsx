export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: '待機中',   color: 'text-gray-400 bg-gray-800' },
  processing: { label: '収集中',   color: 'text-blue-400 bg-blue-900/30' },
  completed:  { label: '完了',     color: 'text-green-400 bg-green-900/30' },
  failed:     { label: '失敗',     color: 'text-red-400 bg-red-900/30' },
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
            select: { hasForm: true },
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">マイリスト</h1>
        <p className="text-sm text-gray-400">LINEで依頼した営業リストの一覧です</p>
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
            const formCount = job.urls.filter((u) => u.hasForm).length
            const status = STATUS_LABEL[job.status] ?? { label: job.status, color: 'text-gray-400 bg-gray-800' }

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
                    <span>フォームあり: <span className="text-orange-400">{formCount}件</span></span>
                  </div>
                  {job.completedAt && (
                    <p className="text-xs text-gray-600 mt-1">
                      完了: {new Date(job.completedAt).toLocaleString('ja-JP')}
                    </p>
                  )}
                </div>
                {job.status === 'completed' && formCount > 0 && (
                  <Link
                    href={`/compose/${job.id}`}
                    className="shrink-0 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
                  >
                    フォーム送信へ →
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
