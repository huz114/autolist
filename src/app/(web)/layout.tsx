'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { SessionProvider } from 'next-auth/react'

function NavBar() {
  const { data: session } = useSession()

  return (
    <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            オート<span className="text-orange-400">リスト</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/my-lists"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                マイリスト
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
        <NavBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-gray-500">
          {/* TODO: 公開前に法的ページの内容を作成すること */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
            <Link href="/legal/tokushoho" className="hover:text-white transition-colors">特定商取引法に基づく表記</Link>
            <span>|</span>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
            <span>|</span>
            <Link href="/legal/terms" className="hover:text-white transition-colors">利用規約</Link>
            <span>|</span>
            <Link href="/legal/company" className="hover:text-white transition-colors">運営者情報</Link>
          </div>
          <div className="text-sm">
            &copy; 2026 オートリスト — powered by{' '}
            <a
              href="https://shiryolog.com"
              className="text-orange-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              シリョログ
            </a>
          </div>
        </footer>
      </div>
    </SessionProvider>
  )
}
