import Link from 'next/link'

export default function TokushohoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-[#f0f4f8] mb-2">特定商取引法に基づく表記</h1>
      <p className="text-[#8494a7] text-sm mb-10">施行日: 2026年3月17日</p>

      <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.07)]">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">事業者名</th>
              <td className="px-5 py-4 text-gray-200">アイル（AI'll）</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">代表者</th>
              <td className="px-5 py-4 text-gray-200">宇座 大陽</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">所在地</th>
              <td className="px-5 py-4 text-gray-200">請求があった場合に遅滞なく開示いたします</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">電話番号</th>
              <td className="px-5 py-4 text-gray-200">請求があった場合に遅滞なく開示いたします</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">メールアドレス</th>
              <td className="px-5 py-4 text-gray-200">info@ai-ll.co</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">販売価格</th>
              <td className="px-5 py-4 text-gray-200">
                <ul className="space-y-1">
                  <li>ライトプラン: ¥2,000（100クレジット）</li>
                  <li>スタンダードプラン: ¥5,000（300クレジット）</li>
                  <li>プレミアムプラン: ¥10,000（700クレジット）</li>
                  <li>エンタープライズプラン: ¥15,000（1,500クレジット）</li>
                </ul>
                <p className="text-[#8fa3b8] text-xs mt-2">※1クレジット＝フォームあり企業1件のリストアップ</p>
              </td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">支払方法</th>
              <td className="px-5 py-4 text-gray-200">クレジットカード（Stripe決済）</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">支払時期</th>
              <td className="px-5 py-4 text-gray-200">購入時即時決済</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">商品の引渡し時期</th>
              <td className="px-5 py-4 text-gray-200">クレジット購入後、即時利用可能。<br />リスト収集は依頼後、数十分〜数時間で完了します。</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">返品・交換</th>
              <td className="px-5 py-4 text-gray-200">デジタルサービスの性質上、購入後の返品・返金は原則としてお受けしておりません。ただし、サービスの不具合等により正常にご利用いただけなかった場合は、個別に対応いたします。</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">動作環境</th>
              <td className="px-5 py-4 text-gray-200">Google Chrome 最新版推奨</td>
            </tr>
            <tr>
              <th className="px-5 py-4 text-left text-[#8fa3b8] bg-[#0d1526] w-1/3 align-top font-medium">適格請求書発行事業者登録番号</th>
              <td className="px-5 py-4 text-gray-200">
                未登録
                <p className="text-[#8fa3b8] text-xs mt-2">※当事業者は適格請求書発行事業者の登録を受けておりません。そのため、インボイス（適格請求書）の発行には対応しておりません。</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav className="flex justify-between items-center mt-12 pt-6 border-t border-[rgba(255,255,255,0.07)]" aria-label="法的ページナビゲーション">
        <span />
        <Link href="/legal/privacy" className="text-sm text-[#8494a7] hover:text-[#06C755] transition-colors">
          次: プライバシーポリシー &rarr;
        </Link>
      </nav>

      <p className="text-[#8494a7] text-xs mt-8 text-center">オートリスト — powered by シリョログ</p>
    </div>
  )
}
