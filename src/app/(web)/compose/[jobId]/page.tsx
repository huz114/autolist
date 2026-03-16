export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import ComposeClient from './compose-client'

export default async function ComposePage({ params }: { params: { jobId: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/compose/${params.jobId}`)
  }

  // jobを取得（ユーザーの所有チェックも兼ねて LineUser 経由でフィルタ）
  const job = await prisma.listJob.findFirst({
    where: {
      id: params.jobId,
      user: {
        userId: session.user.id,
      },
    },
    select: {
      id: true,
      keyword: true,
      industry: true,
      location: true,
      totalFound: true,
      status: true,
    },
  })

  if (!job) {
    notFound()
  }

  return (
    <ComposeClient
      job={job}
      userEmail={session.user.email ?? ''}
    />
  )
}
