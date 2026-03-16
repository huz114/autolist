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
      user: {
        userId: session.user.id,
      },
    },
    include: {
      urls: {
        where: { hasForm: true, companyVerified: true },
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
          excluded: true,
        },
      },
    },
  })

  if (!job) {
    notFound()
  }

  const isConfirmed = job.confirmedAt !== null

  return (
    <ResultsClient
      jobId={job.id}
      keyword={job.keyword}
      industry={job.industry}
      location={job.location}
      urls={job.urls}
      isConfirmed={isConfirmed}
    />
  )
}
