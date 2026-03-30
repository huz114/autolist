export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import NewRequestButton from './NewRequestButton'
import LineLinkButton from './LineLinkButton'
import JobList from './JobList'
import type { Job } from './JobList'
import MyListsTabs from './MyListsTabs'

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

  // Get send record count for badge
  const sendCount = await prisma.sendRecord.count({
    where: { userId: session.user.id },
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#f0f4f8] mb-0.5">マイリスト</h1>
          <p className="text-sm text-[#8fa3b8] whitespace-nowrap">作成した営業リストの一覧です</p>
        </div>
        <div className="shrink-0">
          <NewRequestButton />
        </div>
      </div>
      <div className="mb-8">
        <LineLinkButton />
      </div>

      <Suspense fallback={null}>
        <MyListsTabs jobs={jobs} sendCount={sendCount} />
      </Suspense>
    </div>
  )
}
