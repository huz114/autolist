'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CancelButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    if (!confirm('本当にキャンセルしますか？収集済み分のみ課金されます。')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/cancel-job/${jobId}`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'キャンセルに失敗しました')
      }
    } catch {
      alert('キャンセルに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-50"
    >
      {loading ? 'キャンセル中...' : 'キャンセル'}
    </button>
  )
}
