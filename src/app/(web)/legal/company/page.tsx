import Link from 'next/link'

export default function CompanyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-[#f0f4f8] mb-10">運営者情報</h1>

      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.07)]">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">サービス名</th>
              <td className="px-5 py-4 text-gray-200">オートリスト</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">運営</th>
              <td className="px-5 py-4 text-gray-200">アイル（AI'll）</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">代表者</th>
              <td className="px-5 py-4 text-gray-200">宇座 大陽</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">所在地</th>
              <td className="px-5 py-4 text-gray-200">請求があった場合に遅滞なく開示いたします</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">メールアドレス</th>
              <td className="px-5 py-4 text-gray-200">
                <a href="mailto:info@ai-ll.co" className="text-emerald-400 hover:underline">info@ai-ll.co</a>
              </td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">事業内容</th>
              <td className="px-5 py-4 text-gray-200">AI営業支援サービスの企画・開発・運営</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">設立</th>
              <td className="px-5 py-4 text-gray-200">2026年</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 font-medium">関連サービス</th>
              <td className="px-5 py-4 text-gray-200">
                <a href="https://shiryolog.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  シリョログ（shiryolog.com）
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav className="flex justify-between items-center mt-12 pt-6 border-t border-[rgba(255,255,255,0.07)]" aria-label="法的ページナビゲーション">
        <Link href="/legal/terms" className="text-sm text-[#8494a7] hover:text-[#06C755] transition-colors">
          &larr; 前: 利用規約
        </Link>
        <span />
      </nav>

      <p className="text-[#8494a7] text-xs mt-10 text-center">オートリスト — powered by シリョログ</p>
    </div>
  )
}
