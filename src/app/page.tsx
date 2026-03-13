export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">オートリスト</h1>
          <p className="text-lg text-gray-600">
            LINEでメッセージを送るだけで<br />
            AIがGoogleからビジネスリストを自動収集
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="text-2xl">💬</div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">LINEで簡単操作</h2>
                <p className="text-gray-600 text-sm">
                  「IT企業 東京 100社リストして」と送るだけ。
                  複雑な操作は一切不要です。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🤖</div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">AI自動解析</h2>
                <p className="text-gray-600 text-sm">
                  Claude AIが業種・地域・件数を自動解析。
                  自然な日本語でリクエストできます。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔍</div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">Google自動収集</h2>
                <p className="text-gray-600 text-sm">
                  Serper APIでGoogleを検索し、
                  指定した件数のURLを自動収集します。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="text-2xl">📤</div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">シリョログ連携</h2>
                <p className="text-gray-600 text-sm">
                  収集したリストをシリョログでフォーム送信。
                  営業活動を効率化します。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How to Use */}
        <div className="bg-green-50 rounded-xl p-6 mb-8">
          <h2 className="font-bold text-gray-900 mb-4">使い方</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
              <span className="text-gray-700">LINEでオートリストを友達追加</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
              <span className="text-gray-700">「IT企業 東京 100社」のようにメッセージ</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
              <span className="text-gray-700">AIが自動収集して完了通知を送信</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
              <span className="text-gray-700">シリョログでリストを確認・送信</span>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="text-center text-gray-400 text-sm">
          <p>Webhook: <code className="bg-gray-100 px-2 py-1 rounded">/api/webhook</code></p>
          <p className="mt-1">Process Jobs: <code className="bg-gray-100 px-2 py-1 rounded">/api/process-jobs</code></p>
        </div>
      </div>
    </main>
  );
}
