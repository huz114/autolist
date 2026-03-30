export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { prismaShiryolog } from '@/lib/prisma-shiryolog'
import { redirect } from 'next/navigation'
import BulkSendClient from './bulk-send-client'

export default async function BulkSendPage({
  searchParams,
}: {
  searchParams: { ids?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/send/bulk')
  }

  const ids = searchParams.ids?.split(',').filter(Boolean) ?? []
  if (ids.length === 0) {
    redirect('/my-lists')
  }

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
      senderPrefecture: true,
      senderCity: true,
      senderBuilding: true,
      senderPostalCode: true,
      lastSubject: true,
      lastBody: true,
    },
  })

  return (
    <BulkSendClient
      companyIds={ids}
      initialProfile={{
        companyName: user?.companyName ?? '',
        personName: user?.name ?? '',
        furigana: user?.senderFurigana ?? '',
        senderEmail: user?.senderEmail ?? '',
        phone: user?.phone ?? '',
        companyUrl: user?.companyUrl ?? '',
        title: user?.senderTitle ?? '',
        prefecture: user?.senderPrefecture ?? '',
        city: user?.senderCity ?? '',
        building: user?.senderBuilding ?? '',
        postalCode: user?.senderPostalCode ?? '',
      }}
      initialMessage={{
        subject: user?.lastSubject ?? '',
        body: user?.lastBody ?? '',
      }}
    />
  )
}
