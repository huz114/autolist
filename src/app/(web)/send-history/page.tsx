export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import SendHistoryClient from './send-history-client'

export default async function SendHistoryPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/send-history')
  }

  return <SendHistoryClient />
}
