export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import PurchaseHistoryClient from './purchase-history-client'

export default async function PurchaseHistoryPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/purchase-history')
  }

  return <PurchaseHistoryClient />
}
