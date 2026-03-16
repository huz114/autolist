'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type UrlItem = {
  id: string
  url: string
  companyName: string | null
  industry: string | null
  location: string | null
  phoneNumber: string | null
  employeeCount: string | null
  formUrl: string | null
  excluded: boolean
}

type Props = {
  jobId: string
  keyword: string
  industry: string | null
  location: string | null
  urls: UrlItem[]
  isConfirmed: boolean
}

export default function ResultsClient({ jobId, keyword, industry, location, urls, isConfirmed }: Props) {
  const router = useRouter()
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => {
    // 確定済みの場合はDB上のexcludedを反映
    if (isConfirmed) {
      return new Set(urls.filter(u => u.excluded).map(u => u.id))
    }
    return new Set<string>()
  })
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(isConfirmed)
  const [error, setError] = useState<string | null>(null)

  const activeCount = urls.length - excludedIds.size
  const excludedCount = excludedIds.size

  const toggleExclude = useCallback((id: string) => {
    if (confirmed) return
    setExcludedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [confirmed])

  const handleConfirm = async () => {
    if (confirming || confirmed) return
    setConfirming(true)
    setError(null)

    try {
      const res = await fetch(`/api/confirm-list/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedIds: Array.from(excludedIds) }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'Insufficient credits') {
          setError(`クレジットが不足しています（必要: ${data.required}件、残り: ${data.available}件）`)
        } else {
          setError(data.error || 'エラーが発生しました')
        }
        return
      }

      setConfirmed(true)
      router.refresh()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setConfirming(false)
    }
  }

  // コピー防止（確定前のみ）
  useEffect(() => {
    if (confirmed) return

    const handleCopy = (e: Event) => { e.preventDefault() }
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a' || e.key === 'C' || e.key === 'A')) {
        e.preventDefault()
      }
    }
    const handleContextMenu = (e: Event) => { e.preventDefault() }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [confirmed])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link
          href="/my-lists"
          className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          &larr; マイリストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">企業リスト</h1>
        <p className="text-sm text-gray-400">
          {confirmed ? 'フォームあり企業の一覧です' : 'リストを精査してください'}
        </p>
      </div>

      {/* Job情報バナー */}
      <div className="bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">キーワード</span>
          <span className="text-white font-medium">{keyword}</span>
        </div>
        {industry && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">業種</span>
            <span className="text-white">{industry}</span>
          </div>
        )}
        {location && (
          <div>
            <span className="text-xs text-gray-500 block mb-0.5">エリア</span>
            <span className="text-white">{location}</span>
          </div>
        )}
        <div>
          <span className="text-xs text-gray-500 block mb-0.5">
            {confirmed ? 'フォームあり企業' : '収集企業数'}
          </span>
          <span className="text-emerald-400 font-medium">{urls.length}件</span>
        </div>
        {!confirmed && excludedCount > 0 && (
          <>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">除外</span>
              <span className="text-red-400 font-medium">{excludedCount}件</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">残り</span>
              <span className="text-emerald-400 font-medium">{activeCount}件</span>
            </div>
          </>
        )}
      </div>

      {/* 案内メッセージ（確定前のみ） */}
      {!confirmed && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm text-blue-300">
            リストをご確認ください。業種が異なる企業は「リストから外す」で除外できます。除外した企業は課金対象外になります。
          </p>
        </div>
      )}

      {/* 確定済み: フォーム送信の準備ボタン */}
      {confirmed && (
        <div className="flex justify-end mb-6">
          <Link
            href={`/compose/${jobId}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            フォーム送信の準備へ &rarr;
          </Link>
        </div>
      )}

      {/* 企業リスト */}
      {urls.length === 0 ? (
        <div className="bg-[#16161f] border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-gray-400">フォームあり企業が見つかりませんでした</p>
        </div>
      ) : (
        <div
          className="space-y-3"
          style={!confirmed ? { userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
        >
          {urls.map((u, idx) => {
            const isExcluded = excludedIds.has(u.id)
            // 確定済みで除外された企業は表示しない
            if (confirmed && isExcluded) return null

            return (
              <div
                key={u.id}
                className={`bg-[#16161f] border border-white/10 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-opacity ${
                  isExcluded ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-xs text-gray-600 tabular-nums mt-0.5 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {u.companyName ?? u.url}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {u.industry && (
                        <span className="text-xs text-gray-500">{u.industry}</span>
                      )}
                      {u.location && (
                        <span className="text-xs text-gray-500">{u.location}</span>
                      )}
                      {u.employeeCount && confirmed && (
                        <span className="text-xs text-gray-500">従業員: {u.employeeCount}</span>
                      )}
                      {/* 電話番号は確定後のみ表示 */}
                      {u.phoneNumber && confirmed && (
                        <span className="text-xs text-gray-500">{u.phoneNumber}</span>
                      )}
                    </div>
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors truncate block mt-0.5"
                      onClick={(e) => {
                        if (!confirmed) {
                          // リンクは開けるが選択防止のため
                        }
                      }}
                    >
                      {u.url}
                    </a>
                  </div>
                </div>
                {/* 確定前: リストから外す / 元に戻す ボタン */}
                {!confirmed && (
                  <button
                    onClick={() => toggleExclude(u.id)}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                      isExcluded
                        ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'
                        : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                    }`}
                  >
                    {isExcluded ? '元に戻す' : 'リストから外す'}
                  </button>
                )}
                {/* 確定後: フォームを開くボタン */}
                {confirmed && u.formUrl && (
                  <a
                    href={u.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    フォームを開く
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 確定ボタン（確定前のみ） */}
      {!confirmed && urls.length > 0 && (
        <div className="mt-8">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-5 py-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={confirming || activeCount <= 0}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-xl transition-colors text-sm"
          >
            {confirming
              ? '確定中...'
              : `この内容で確定する（${activeCount}件 / ${activeCount}クレジット消費）`
            }
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            確定後にクレジットが消費されます。確定前は課金されません。
          </p>
        </div>
      )}

      {/* 確定済み: 下部にもフォーム送信ボタン */}
      {confirmed && urls.length > 5 && (
        <div className="flex justify-end mt-6">
          <Link
            href={`/compose/${jobId}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            フォーム送信の準備へ &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
