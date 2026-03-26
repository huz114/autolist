export const dynamic = 'force-dynamic'

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

      <MyListsTabs jobs={jobs} />
    </div>
  )
}
