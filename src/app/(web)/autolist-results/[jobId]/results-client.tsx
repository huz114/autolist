'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFocusTrap } from '@/lib/useFocusTrap'

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
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const confirmModalRef = useFocusTrap(showConfirmModal, () => { if (!confirming) setShowConfirmModal(false) })
  const [currentCredits, setCurrentCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(false)

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

  const openConfirmModal = async () => {
    if (confirming || confirmed) return
    setShowConfirmModal(true)
    setCreditsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/credits')
      const data = await res.json()
      if (res.ok) {
        setCurrentCredits(data.credits)
      } else {
        setCurrentCredits(null)
      }
    } catch {
      setCurrentCredits(null)
    } finally {
      setCreditsLoading(false)
    }
  }

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

      router.push(`/send/${jobId}`)
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message === 'Failed to fetch') {
        setError('ネットワークに接続できません。インターネット接続を確認してください。')
      } else {
        setError('通信エラーが発生しました。しばらく時間をおいて再度お試しください。')
      }
    } finally {
      setConfirming(false)
    }
  }


  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* ヘッダー */}
      <div className="mb-6">
        <Link
          href="/my-lists"
          className="inline-flex items-center gap-2 text-sm text-[#06C755] hover:text-[#04a344] font-medium bg-[rgba(6,199,85,0.08)] hover:bg-[rgba(6,199,85,0.15)] border border-[rgba(6,199,85,0.2)] hover:border-[rgba(6,199,85,0.4)] px-4 py-2 rounded-full transition-all mb-4"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          マイリストに戻る
        </Link>
        <h1 className="text-2xl font-bold text-[#f0f4f8] mb-1">企業リスト</h1>
        <p className="text-sm text-[#8fa3b8]">
          {confirmed ? 'フォームあり企業の一覧です' : 'リストを精査してください'}
        </p>
      </div>

      {/* Job情報バナー */}
      <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl px-5 py-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <span className="text-xs text-[#8494a7] block mb-0.5">キーワード</span>
          <span className="text-[#f0f4f8] font-medium">{keyword}</span>
        </div>
        {industry && (
          <div>
            <span className="text-xs text-[#8494a7] block mb-0.5">業種</span>
            <span className="text-[#f0f4f8]">{industry}</span>
          </div>
        )}
        {location && (
          <div>
            <span className="text-xs text-[#8494a7] block mb-0.5">エリア</span>
            <span className="text-[#f0f4f8]">{location}</span>
          </div>
        )}
        <div>
          <span className="text-xs text-[#8494a7] block mb-0.5">
            {confirmed ? 'フォームあり企業' : '収集企業数'}
          </span>
          <span className="text-[#06C755] font-medium">{urls.length}件</span>
        </div>
        {!confirmed && excludedCount > 0 && (
          <>
            <div>
              <span className="text-xs text-[#8494a7] block mb-0.5">除外</span>
              <span className="text-[#ff4757] font-medium">{excludedCount}件</span>
            </div>
            <div>
              <span className="text-xs text-[#8494a7] block mb-0.5">残り</span>
              <span className="text-[#06C755] font-medium">{activeCount}件</span>
            </div>
          </>
        )}
      </div>

      {/* 案内メッセージ（確定前のみ） */}
      {!confirmed && (
        <div className="bg-[rgba(6,199,85,0.05)] border border-[rgba(6,199,85,0.2)] rounded-2xl px-5 py-4 mb-6">
          <p className="text-sm text-[#8fa3b8]">
            リストをご確認ください。業種が異なる企業は「リストから外す」で除外できます。除外した企業は課金対象外になります。
          </p>
        </div>
      )}

      {/* 確定済み: フォーム送信の準備ボタン */}
      {confirmed && (
        <div className="flex justify-end mb-6">
          <Link
            href={`/send/${jobId}`}
            className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] whitespace-nowrap"
          >
            フォーム送信へ &rarr;
          </Link>
        </div>
      )}

      {/* 企業リスト */}
      {urls.length === 0 ? (
        <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(6,199,85,0.1)] border border-[rgba(6,199,85,0.4)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#06C755]">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          <p className="text-[#f0f4f8] font-medium mb-2">企業データがありません</p>
          <p className="text-sm text-[#8494a7] mb-6">
            この検索条件ではフォームのある企業が見つかりませんでした。別の業種・地域で再度お試しください。
          </p>
          <Link
            href="/my-lists"
            className="inline-flex items-center gap-1.5 bg-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.12)] text-[#f0f4f8] text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
          >
            マイリストに戻る
          </Link>
        </div>
      ) : (
        <div className="space-y-3 relative">
          {/* ウォーターマーク（確定前のみ） */}
          {!confirmed && (
            <div
              className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
              aria-hidden="true"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="120"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="rgba(255,255,255,0.06)" transform="rotate(-30,130,60)">オートリスト</text></svg>')}")`,
                backgroundRepeat: 'repeat',
              }}
            />
          )}
          {urls.map((u, idx) => {
            const isExcluded = excludedIds.has(u.id)
            // 確定済みで除外された企業は表示しない
            if (confirmed && isExcluded) return null

            return (
              <div
                key={u.id}
                className={`bg-[#111827] border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-all ${
                  isExcluded
                    ? 'opacity-50 border-[rgba(255,71,87,0.2)] bg-[rgba(255,71,87,0.02)]'
                    : 'border-[rgba(255,255,255,0.07)] hover:border-[rgba(6,199,85,0.4)]'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-xs tabular-nums mt-0.5 shrink-0 ${isExcluded ? 'text-[#ff4757]/50' : 'text-[#8494a7]'}`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${isExcluded ? 'text-[#8fa3b8] line-through' : 'text-[#f0f4f8]'}`}>
                        {u.companyName ?? u.url}
                      </p>
                      {isExcluded && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,71,87,0.15)] text-[#ff4757] border border-[rgba(255,71,87,0.25)]">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          除外
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {u.industry && (
                        <span className="text-xs text-[#8494a7]">{u.industry}</span>
                      )}
                      {u.location && (
                        <span className="text-xs text-[#8494a7]">{u.location}</span>
                      )}
                      {u.employeeCount && confirmed && (
                        <span className="text-xs text-[#8494a7]">従業員: {u.employeeCount}</span>
                      )}
                      {/* 電話番号は確定後のみ表示 */}
                      {u.phoneNumber && confirmed && (
                        <span className="text-xs text-[#8494a7]">{u.phoneNumber}</span>
                      )}
                    </div>
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs transition-colors truncate block mt-0.5 ${isExcluded ? 'text-[#8494a7] hover:text-[#8fa3b8]' : 'text-[#06C755] hover:text-[#04a344]'}`}
                    >
                      {u.url}
                    </a>
                  </div>
                </div>
                {/* 確定前: リストから外す / 元に戻す ボタン */}
                {!confirmed && (
                  <button
                    onClick={() => toggleExclude(u.id)}
                    className={`shrink-0 text-xs font-medium px-4 py-2 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      isExcluded
                        ? 'bg-[rgba(6,199,85,0.1)] hover:bg-[rgba(6,199,85,0.2)] text-[#06C755] border border-[rgba(6,199,85,0.3)]'
                        : 'bg-[rgba(255,71,87,0.08)] hover:bg-[rgba(255,71,87,0.15)] text-[#ff4757] border border-[rgba(255,71,87,0.2)]'
                    }`}
                  >
                    {isExcluded ? 'リストに戻す' : 'リストから外す'}
                  </button>
                )}
                {/* 確定後: 確定済みバッジ */}
                {confirmed && (
                  <span className="shrink-0 text-xs font-medium bg-[rgba(6,199,85,0.1)] text-[#06C755] border border-[rgba(6,199,85,0.25)] px-3 py-1.5 rounded-full whitespace-nowrap">
                    確定済み
                  </span>
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
            <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-5 py-3 mb-4">
              <p className="text-sm text-[#ff4757]">{error}</p>
            </div>
          )}
          <button
            onClick={openConfirmModal}
            disabled={confirming || activeCount <= 0}
            className="w-full bg-[#06C755] hover:bg-[#04a344] disabled:bg-[#0d1526] disabled:text-[#8494a7] text-white font-bold py-3 rounded-full transition-all flex flex-col items-center cursor-pointer hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
          >
            {confirming
              ? '確定中...'
              : <>
                  <span className="text-sm">確定してフォーム送信の準備へ</span>
                  <span className="text-sm text-white/70">（確定{activeCount}件{excludedCount > 0 ? ` / ${excludedCount}クレジット返却` : ''}）</span>
                </>
            }
          </button>
          <p className="text-xs text-[#8494a7] text-center mt-2">
            クレジットは依頼時に仮押さえ済みです。
          </p>
        </div>
      )}

      {/* 確定確認モーダル */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirming) setShowConfirmModal(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-label="リスト確定確認"
        >
          <div ref={confirmModalRef} className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">リストを確定しますか？</h2>
            <p className="text-sm text-[#8fa3b8] mb-5">
              確定後は企業の除外・変更ができなくなります
            </p>

            {/* クレジット内訳 */}
            <div className="bg-[#0a0f1c] border border-[rgba(255,255,255,0.07)] rounded-2xl px-5 py-4 space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8fa3b8]">現在の残クレジット</span>
                {creditsLoading ? (
                  <span className="text-[#8494a7]">読み込み中...</span>
                ) : currentCredits !== null ? (
                  <span className="text-[#f0f4f8] font-medium">{currentCredits}件</span>
                ) : (
                  <span className="text-[#8494a7]">取得できませんでした</span>
                )}
              </div>
              <div className="border-t border-[rgba(255,255,255,0.07)]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8fa3b8]">依頼時の予約</span>
                <span className="text-[#f0f4f8] font-medium">{urls.length}件</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8fa3b8]">除外による返却</span>
                <span className={`font-medium ${excludedCount > 0 ? 'text-[#06C755]' : 'text-[#f0f4f8]'}`}>
                  {excludedCount}件
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8fa3b8]">最終確定</span>
                <span className="text-[#f0f4f8] font-medium">{activeCount}件</span>
              </div>
              <div className="border-t border-[rgba(255,255,255,0.07)]" />
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-[#8fa3b8]">確定後の残クレジット</span>
                {creditsLoading ? (
                  <span className="text-[#8494a7]">読み込み中...</span>
                ) : currentCredits !== null ? (
                  <span className="text-[#06C755] font-bold text-base">
                    {currentCredits + excludedCount}件
                  </span>
                ) : (
                  <span className="text-[#8494a7]">取得できませんでした</span>
                )}
              </div>
            </div>

            {/* 説明テキスト */}
            <p className="text-xs text-[#8494a7] mb-5">
              {excludedCount > 0
                ? `除外した${excludedCount}件分のクレジットが返却されます`
                : '除外はありません。依頼時に引き落とし済みのクレジットがそのまま確定されます'}
            </p>

            {error && (
              <div className="bg-[rgba(255,71,87,0.1)] border border-[rgba(255,71,87,0.3)] rounded-xl px-4 py-2.5 mb-4">
                <p className="text-[#ff4757] text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirmModal(false); setError(null); }}
                disabled={confirming}
                className="flex-1 bg-transparent border border-[rgba(255,255,255,0.07)] text-[#8fa3b8] hover:text-[#f0f4f8] hover:border-[rgba(255,255,255,0.15)] font-medium py-2.5 rounded-full transition-colors text-sm disabled:opacity-50 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleConfirm()
                  // handleConfirm navigates on success, so modal closes automatically
                }}
                disabled={confirming}
                className="flex-1 bg-[#06C755] hover:bg-[#04a344] disabled:bg-[#0d1526] disabled:text-[#8494a7] text-white font-bold py-2.5 rounded-full transition-all text-sm disabled:cursor-not-allowed cursor-pointer hover:shadow-[0_0_20px_rgba(6,199,85,0.3)]"
              >
                {confirming ? '確定中...' : '確定する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確定済み: 下部にもフォーム送信ボタン */}
      {confirmed && urls.length > 5 && (
        <div className="flex justify-end mt-6">
          <Link
            href={`/send/${jobId}`}
            className="bg-[#06C755] hover:bg-[#04a344] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.3)] whitespace-nowrap"
          >
            フォーム送信へ &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
