import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-4xl font-bold text-white mb-3">オートリスト</h1>
          <p className="text-lg text-gray-400">
            LINEでメッセージを送るだけで<br />
            AIがGoogleからビジネスリストを自動収集
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors text-lg"
          >
            無料で始める
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold transition-colors text-lg"
          >
            ログイン
          </Link>
          <a
            href="https://line.me/R/ti/p/@autolist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#06C755] hover:bg-[#05b34d] text-white font-semibold transition-colors text-lg"
          >
            LINE友だち追加
          </a>
        </div>

        {/* Features */}
        <div className="grid gap-4 mb-12">
          <div className="rounded-xl p-6 border border-gray-800" style={{ background: '#16161f' }}>
            <div className="flex items-start gap-4">
              <div className="text-2xl">💬</div>
              <div>
                <h2 className="font-semibold text-white mb-1">LINEで簡単操作</h2>
                <p className="text-gray-400 text-sm">
                  「IT企業 東京 100社リストして」と送るだけ。
                  複雑な操作は一切不要です。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-gray-800" style={{ background: '#16161f' }}>
            <div className="flex items-start gap-4">
              <div className="text-2xl">🤖</div>
              <div>
                <h2 className="font-semibold text-white mb-1">AI自動解析</h2>
                <p className="text-gray-400 text-sm">
                  AIが業種・地域・件数を自動解析。
                  自然な日本語でリクエストできます。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-gray-800" style={{ background: '#16161f' }}>
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔍</div>
              <div>
                <h2 className="font-semibold text-white mb-1">Google自動収集</h2>
                <p className="text-gray-400 text-sm">
                  Googleを検索し、
                  指定した件数のURLを自動収集します。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-6 border border-gray-800" style={{ background: '#16161f' }}>
            <div className="flex items-start gap-4">
              <div className="text-2xl">📤</div>
              <div>
                <h2 className="font-semibold text-white mb-1">シリョログ連携</h2>
                <p className="text-gray-400 text-sm">
                  収集したリストをシリョログでフォーム送信。
                  営業活動を効率化します。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How to Use */}
        <div className="rounded-xl p-6 mb-8 border border-gray-800" style={{ background: '#16161f' }}>
          <h2 className="font-bold text-white mb-4">使い方</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
              <span className="text-gray-300">LINEでオートリストを友達追加</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
              <span className="text-gray-300">「IT企業 東京 100社」のようにメッセージ</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
              <span className="text-gray-300">AIが自動収集して完了通知を送信</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">4</span>
              <span className="text-gray-300">シリョログでリストを確認・送信</span>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors text-lg"
          >
            無料で始める
          </Link>
        </div>
      </div>
    </main>
  );
}
