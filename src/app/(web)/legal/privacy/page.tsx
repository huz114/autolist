export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-white mb-2">プライバシーポリシー</h1>
      <p className="text-gray-500 text-sm mb-10">施行日: 2026年3月17日</p>

      <div className="space-y-10 text-gray-300 text-sm leading-relaxed">
        <p>
          アイル（以下「当事業者」）は、オートリスト（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
        </p>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第1条（個人情報の定義）</h2>
          <p>
            本ポリシーにおいて「個人情報」とは、個人情報保護法に定める個人情報を指し、生存する個人に関する情報であって、氏名、メールアドレス、その他の記述等により特定の個人を識別できるものをいいます。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第2条（個人情報の収集方法）</h2>
          <p>当事業者は、以下の方法により個人情報を収集することがあります。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>LINE連携によるアカウント紐付け</li>
            <li>会員登録フォームへの入力</li>
            <li>サービス利用時の情報入力</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第3条（収集する情報）</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>メールアドレス</li>
            <li>パスワード（ハッシュ化して保存）</li>
            <li>氏名</li>
            <li>LINEユーザーID（LINE連携時）</li>
            <li>送信者情報（メールアドレス・肩書き・送信メッセージ等、フォーム送信機能利用時）</li>
            <li>決済情報（Stripeが管理し、当事業者はクレジットカード番号等を保持しません）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第4条（利用目的）</h2>
          <p>当事業者は、収集した個人情報を以下の目的で利用します。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>本サービスの提供・運営</li>
            <li>本人確認・認証</li>
            <li>クレジット管理・決済処理</li>
            <li>サービスの改善・新機能開発</li>
            <li>お問い合わせ・サポート対応</li>
            <li>重要なお知らせの通知（メール・LINE）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第5条（第三者提供）</h2>
          <p>
            当事業者は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要な場合</li>
            <li>公衆衛生の向上・児童の健全育成のために必要な場合</li>
            <li>国の機関等への協力が必要な場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第6条（外部サービスとの連携）</h2>
          <p>本サービスは以下の外部サービスと連携しています。各サービスにおける情報の取り扱いは、各社のプライバシーポリシーに従います。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>LINE Messaging API（LINEヤフー株式会社 — 依頼受付・通知送信）</li>
            <li>Stripe（Stripe, Inc. — 決済処理。カード情報はStripeが管理し、当事業者は保持しません）</li>
            <li>Serper API（Google検索によるウェブサイト収集）</li>
            <li>Google Gemini API（企業情報のAI解析）</li>
            <li>Resend（メール送信）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第7条（Chrome拡張機能について）</h2>
          <p>
            本サービスが提供するChrome拡張機能は、フォーム送信アシスト機能としてウェブページ上のフォーム要素を検出し、自動入力を支援します。閲覧データは送信目的以外に使用しません。サーバーとの通信は、送信先企業情報の取得および送信結果の記録に限定されます。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第8条（データの安全管理）</h2>
          <p>当事業者は、個人情報の漏洩・紛失・毀損を防止するため、以下の措置を講じます。</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
            <li>SSL/TLS暗号化による通信の保護</li>
            <li>パスワードのハッシュ化保存</li>
            <li>アクセス制御（認証トークンによるセッション管理）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第9条（開示・訂正・削除の請求）</h2>
          <p>
            ユーザーは、当事業者が保有する個人情報について、開示・訂正・削除を請求することができます。ご請求は下記のお問い合わせ先までご連絡ください。本人確認のうえ、速やかに対応いたします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第10条（ポリシーの変更）</h2>
          <p>
            当事業者は、必要に応じて本ポリシーを変更することがあります。変更後のプライバシーポリシーは本ページに掲載した時点で効力を生じるものとします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">第11条（お問い合わせ先）</h2>
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
