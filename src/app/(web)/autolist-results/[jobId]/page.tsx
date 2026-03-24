export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import ResultsClient from './results-client'

export default async function AutolistResultsPage({ params }: { params: { jobId: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/autolist-results/${params.jobId}`)
  }

  const job = await prisma.listJob.findFirst({
    where: {
      id: params.jobId,
      userId: session.user.id,
    },
    include: {
      urls: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          url: true,
          companyName: true,
          industry: true,
          location: true,
          phoneNumber: true,
          employeeCount: true,
          capitalAmount: true,
          representativeName: true,
          establishedYear: true,
          businessDescription: true,
          formUrl: true,
          hasForm: true,
          excluded: true,
          email: true,
          snsLinks: true,
          hasRecruitPage: true,
          siteUpdatedAt: true,
          searchTags: true,
          industryMajor: true,
          industryMinor: true,
        },
      },
    },
  })

  if (!job) {
    notFound()
  }

  return (
    <ResultsClient
      jobId={job.id}
      keyword={job.keyword}
      industry={job.industry}
      location={job.location}
      urls={job.urls}
    />
  )
}
