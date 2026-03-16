export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export default async function AutolistResultsPage({ params }: { params: { jobId: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/autolist-results/${params.jobId}`)
  }

  const job = await prisma.listJob.findFirst({
    where: {
      id: params.jobId,
      user: {
        userId: session.user.id,
      },
    },
    include: {
      urls: {
        where: { hasForm: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          url: true,
          companyName: true,
          industry: true,
          location: true,
          phoneNumber: true,
          employeeCount: true,
          formUrl: true,
        },
      },
    },
  })

  if (!job) {
    notFound()
  }

  const formUrls = job.urls

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link
          href="/my-lists"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          ← マイリストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">企業リスト</h1>
        <p className="text-sm text-gray-400">フォームあり企業の一覧です</p>
      </div>

      {/* Job情報バナー */}
      <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">キーワード</span>
          <span className="text-white font-medium">{job.keyword}</span>
        </div>
        {job.industry && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">業種</span>
            <span className="text-white">{job.industry}</span>
          </div>
        )}
        {job.location && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">エリア</span>
            <span className="text-white">{job.location}</span>
          </div>
        )}
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">フォームあり企業</span>
          <span className="text-emerald-400 font-medium">{formUrls.length}件</span>
        </div>
      </div>

      {/* フォーム送信の準備ボタン */}
      <div className="flex justify-end mb-6">
        <Link
          href={`/compose/${job.id}`}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
        >
          フォーム送信の準備へ →
        </Link>
      </div>

      {/* 企業リスト */}
      {formUrls.length === 0 ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-gray-400">フォームあり企業が見つかりませんでした</p>
        </div>
      ) : (
        <div className="space-y-3">
          {formUrls.map((u, idx) => (
            <div
              key={u.id}
              className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-xs text-gray-600 tabular-nums mt-0.5 shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">
                    {u.companyName ?? u.url}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {u.industry && (
                      <span className="text-xs text-gray-500">{u.industry}</span>
                    )}
                    {u.location && (
                      <span className="text-xs text-gray-500">{u.location}</span>
                    )}
                    {u.employeeCount && (
                      <span className="text-xs text-gray-500">従業員: {u.employeeCount}</span>
                    )}
                    {u.phoneNumber && (
                      <span className="text-xs text-gray-500">{u.phoneNumber}</span>
                    )}
                  </div>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors truncate block mt-0.5"
                  >
                    {u.url}
                  </a>
                </div>
              </div>
              {u.formUrl && (
                <a
                  href={u.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  フォームを開く
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 下部にもフォーム送信ボタン */}
      {formUrls.length > 5 && (
        <div className="flex justify-end mt-6">
          <Link
            href={`/compose/${job.id}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            フォーム送信の準備へ →
          </Link>
        </div>
      )}
    </div>
  )
}
