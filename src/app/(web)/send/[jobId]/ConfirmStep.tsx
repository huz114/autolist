'use client'

import type { Company } from './types'

type Props = {
  companies: Company[]
  totalUrlCount: number
}

export default function ConfirmStep({ companies, totalUrlCount }: Props) {
  const formlessCount = totalUrlCount - companies.length
  return (
    <div className="bg-[#111827] border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-bold text-[#f0f4f8] mb-1">送信先確認</h2>
      <p className="text-sm text-[#8fa3b8] mb-2">
        以下の {companies.length}件 の企業にフォーム送信します。内容を確認してください。
      </p>
      {formlessCount > 0 && (
        <p className="text-xs text-[#8494a7] mb-6 bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
          ※ 収集した全{totalUrlCount}件のうち、お問い合わせフォームが見つかった{companies.length}件が対象です。
          残り{formlessCount}件はフォームが検出されなかったため、テレアポやCSVダウンロードでご活用ください。
        </p>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {companies.map((c, idx) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white/[0.02] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.07)] transition-colors"
          >
            <span className="text-xs text-[#8494a7] tabular-nums shrink-0 w-8 text-right font-mono">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#f0f4f8] truncate">
                {c.companyName ?? c.url}
              </p>
              <div className="flex gap-2 text-xs text-[#8494a7]">
                {c.industry && <span>{c.industry}</span>}
                {c.location && <span>{c.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
