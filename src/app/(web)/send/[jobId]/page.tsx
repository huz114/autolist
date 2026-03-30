export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
import { redirect, notFound } from 'next/navigation'
import SendClient from './send-client'

export default async function SendPage({ params }: { params: { jobId: string } }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/send/${params.jobId}`)
  }

  // jobを取得（確定済みか確認 + ユーザー所有チェック）
  const job = await prisma.listJob.findFirst({
    where: {
      id: params.jobId,
      userId: session.user.id,
    },
    select: {
      id: true,
      keyword: true,
      industry: true,
      location: true,
      confirmedAt: true,
    },
  })

  if (!job) {
    notFound()
  }

  // 未確定ならリダイレクト
  if (!job.confirmedAt) {
    redirect(`/autolist-results/${params.jobId}`)
  }

  // 全URL件数（フォームの有無に関わらず）
  const totalUrlCount = await prisma.collectedUrl.count({
    where: { jobId: params.jobId, excluded: false },
  })

  // 確定済み企業一覧（excluded=false）
  const companies = await prisma.collectedUrl.findMany({
    where: {
      jobId: params.jobId,
      excluded: false,
      hasForm: true,
      companyVerified: true,
    },
    select: {
      id: true,
      companyName: true,
      url: true,
      industry: true,
      location: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // ユーザーの送信者情報
  const user = await prismaShiryolog.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      companyName: true,
      companyUrl: true,
      phone: true,
      senderEmail: true,
      senderFurigana: true,
      senderTitle: true,
      senderAddress: true,
      lastSubject: true,
      lastBody: true,
    },
  })

  const hasProfile = !!(user?.companyName && user?.name)
  const hasMessage = !!(user?.lastSubject && user?.lastBody)

  return (
    <SendClient
      jobId={job.id}
      keyword={job.keyword}
      industry={job.industry}
      location={job.location}
      companies={companies}
      totalUrlCount={totalUrlCount}
      initialProfile={{
        companyName: user?.companyName ?? '',
        personName: user?.name ?? '',
        furigana: user?.senderFurigana ?? '',
        senderEmail: user?.senderEmail ?? '',
        phone: user?.phone ?? '',
        companyUrl: user?.companyUrl ?? '',
        title: user?.senderTitle ?? '',
        address: user?.senderAddress ?? '',
      }}
      initialMessage={{
        subject: user?.lastSubject ?? '',
        body: user?.lastBody ?? '',
      }}
      hasProfile={hasProfile}
      hasMessage={hasMessage}
    />
  )
}
