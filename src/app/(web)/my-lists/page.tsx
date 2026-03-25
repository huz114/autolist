export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import NewRequestButton from './NewRequestButton'
import LineLinkButton from './LineLinkButton'
import JobList from './JobList'
import type { Job } from './JobList'

export default async function MyListsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/my-lists')
  }

  // User.id で直接 ListJob を検索
  const rawJobs = await prisma.listJob.findMany({
    where: { userId: session.user.id },
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
  })

  // Serialize dates for client component
  const jobs: Job[] = rawJobs.map((job) => ({
    id: job.id,
    status: job.status,
    keyword: job.keyword,
    industry: job.industry,
    location: job.location,
    targetCount: job.targetCount,
    totalFound: job.totalFound,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    confirmedAt: job.confirmedAt?.toISOString() ?? null,
    urls: job.urls,
    _count: job._count,
  }))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">マイリスト</h1>
          <p className="text-sm text-[#8fa3b8]">作成した営業リストの一覧です</p>
        </div>
        <NewRequestButton />
      </div>
      <div className="mb-8">
        <LineLinkButton />
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
          <p className="text-sm text-[#8494a7] mb-6">
            業種と地域を指定して、営業リストを作成しましょう
          </p>
          <NewRequestButton />
        </div>
      ) : (
        <JobList initialJobs={jobs} />
      )}
    </div>
  )
}
