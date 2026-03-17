export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-2">利用規約</h1>
      <p className="text-gray-500 text-sm mb-10">施行日: 2026年3月17日</p>

      <div className="space-y-10 text-gray-300 text-sm leading-relaxed">
        <p>
          この利用規約（以下「本規約」）は、アイル（以下「当事業者」）が提供するオートリスト（以下「本サービス」）の利用条件を定めるものです。ユーザーの皆様には、本規約に同意のうえ本サービスをご利用いただきます。
        </p>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第1条（適用範囲）</h2>
          <p>
            本規約は、本サービスの利用に関する当事業者とユーザーとの間の一切の関係に適用されます。本サービスに関連するウェブサイト、LINE Bot、Chrome拡張機能のすべてが対象となります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第2条（アカウント登録）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>ユーザーは、正確かつ最新の情報を登録するものとします。</li>
            <li>1人につき1アカウントの登録とし、複数アカウントの作成は禁止します。</li>
            <li>アカウントの管理はユーザー自身の責任で行うものとし、第三者への貸与・譲渡は禁止します。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第3条（サービス内容）</h2>
          <p>本サービスは以下の機能を提供します。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>LINEまたはWebからの依頼に基づく営業リストの自動生成</li>
            <li>問い合わせフォーム送信支援（Chrome拡張機能）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第4条（クレジット制度）</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-400">
            <li>本サービスはクレジット制を採用しており、以下のプランでクレジットを購入できます。
              <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                <li>ライトプラン: ¥2,000（100クレジット）</li>
                <li>スタンダードプラン: ¥5,000（300クレジット）</li>
                <li>プレミアムプラン: ¥10,000（700クレジット）</li>
                <li>エンタープライズプラン: ¥15,000（1,500クレジット）</li>
              </ul>
            </li>
            <li>1クレジットはフォームあり企業または事業者のURL1件に対応します。</li>
            <li>クレジットの消費はリスト確定時に実績分が課金されます。</li>
            <li>購入済みクレジットに有効期限はありません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第5条（禁止事項）</h2>
          <p>ユーザーは、以下の行為を行ってはなりません。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>不正な手段によるサービスの利用・クレジットの取得</li>
            <li>本サービスのリバースエンジニアリング、逆コンパイル、逆アセンブル</li>
            <li>収集したデータの第三者への再販売</li>
            <li>スパム行為、または迷惑行為を目的としたサービスの利用</li>
            <li>他のユーザーの利用を妨害する行為</li>
            <li>法令または公序良俗に違反する行為</li>
            <li>当事業者または第三者の権利を侵害する行為</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第6条（免責事項）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>当事業者は、収集された企業データの正確性・完全性・最新性を保証するものではありません。</li>
            <li>企業側の情報変更により、収集データと実際の情報に差異が生じる場合があります。</li>
            <li>フォーム送信機能を通じた送信結果（到達・返信等）について、当事業者は一切の保証をいたしません。</li>
            <li>本サービスの利用に起因してユーザーに生じた損害について、当事業者の故意または重過失による場合を除き、当事業者は責任を負いません。</li>
            <li>本サービスを通じてGoogle検索から収集された企業リストの情報は、当事業者が運営する関連サービスにおいて活用される場合があります。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第7条（サービスの変更・停止）</h2>
          <p>
            当事業者は、以下の場合にサービスの全部または一部を変更・停止することがあります。事前に合理的な方法で通知するよう努めますが、緊急の場合はこの限りではありません。
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>システムの保守・点検を行う場合</li>
            <li>天災、停電、その他の不可抗力により提供が困難な場合</li>
            <li>その他、当事業者が停止を必要と判断した場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第8条（知的財産権）</h2>
          <p>
            本サービスに関するすべての知的財産権（著作権、商標権、特許権等）は当事業者または正当な権利者に帰属します。本規約に基づくサービスの利用許諾は、知的財産権の譲渡を意味するものではありません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第9条（準拠法・管轄裁判所）</h2>
          <p>
            本規約の解釈および適用は日本法に準拠するものとします。本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第10条（お問い合わせ先）</h2>
          <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-5 mt-2">
            <p>アイル（個人事業）</p>
            <p>代表者: 宇座 大陽</p>
            <p>メール: <a href="mailto:info@ai-ll.co" className="text-emerald-400 hover:underline">info@ai-ll.co</a></p>
          </div>
        </section>
      </div>

      <p className="text-gray-500 text-xs mt-10 text-center">オートリスト — powered by シリョログ</p>
    </div>
  )
}
