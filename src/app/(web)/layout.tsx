'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { SessionProvider } from 'next-auth/react'

function NavBarInner() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [showPaymentToast, setShowPaymentToast] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // クレジット残高取得
  useEffect(() => {
    if (!session) return
    fetch('/api/user/credits')
      .then(r => r.json())
      .then(data => { if (data.credits !== undefined) setCredits(data.credits) })
      .catch(() => {})
  }, [session])

  // 購入完了トースト
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowPaymentToast(true)
      // クレジット再取得
      fetch('/api/user/credits')
        .then(r => r.json())
        .then(data => { if (data.credits !== undefined) setCredits(data.credits) })
        .catch(() => {})
      // URLクリーン
      window.history.replaceState({}, '', pathname)
      setTimeout(() => setShowPaymentToast(false), 4000)
    }
  }, [searchParams, pathname])

  const isActive = (href: string) => {
    if (href === '/my-lists') {
      return pathname === '/my-lists' || pathname.startsWith('/autolist-results') || pathname.startsWith('/send/') || pathname.startsWith('/send-history')
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
    <header className="border-b border-[rgba(255,255,255,0.07)] bg-[#0a0f1c] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={session ? "/my-lists" : "/"} className="flex items-center gap-2" onClick={closeMenu}>
          <span className="text-lg font-black text-[#f0f4f8]" style={{ letterSpacing: '-0.5px' }}>
            オート<span className="text-[#06C755]">リスト</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/my-lists"
                className={`text-sm transition-colors pb-1 ${isActive('/my-lists') ? 'text-[#f0f4f8] font-semibold border-b-2 border-[#06C755]' : 'text-[#8fa3b8] hover:text-[#c8d6e5]'}`}
              >
                マイリスト
              </Link>
              <Link
                href="/profile"
                className={`text-sm transition-colors pb-1 ${isActive('/profile') ? 'text-[#f0f4f8] font-semibold border-b-2 border-[#06C755]' : 'text-[#8fa3b8] hover:text-[#c8d6e5]'}`}
              >
                プロフィール
              </Link>
              {credits !== null ? (
                <Link href="/credits" className="text-sm text-[#8fa3b8] font-medium cursor-pointer hover:text-[#f0f4f8] transition-colors">
                  💳 {credits.toLocaleString()}件
                </Link>
              ) : session ? (
                <Link href="/credits" className="text-sm text-[#8fa3b8] cursor-pointer hover:text-[#f0f4f8] transition-colors">💳 --件</Link>
              ) : null}
              <Link
                href="/purchase"
                className="text-sm bg-[#06C755] hover:bg-[#04a344] text-white px-4 py-1.5 rounded-full font-bold transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.5)]"
              >
                クレジット購入
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-sm text-[#8494a7] hover:text-[#f0f4f8] transition-colors"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                className="text-sm bg-[#06C755] hover:bg-[#04a344] text-white px-5 py-1.5 rounded-full font-bold transition-all hover:shadow-[0_0_20px_rgba(6,199,85,0.5)]"
              >
                登録
              </Link>
            </>
          )}
        </nav>

        {/* Hamburger button (mobile) */}
        <button
          className="md:hidden relative w-8 h-8 flex items-center justify-center"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f0f4f8"
            strokeWidth="2"
            strokeLinecap="round"
            className="overflow-visible"
          >
            {menuOpen ? (
              <>
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="20" y1="4" x2="4" y2="20" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="border-t border-[rgba(255,255,255,0.07)] px-4 py-4 flex flex-col gap-3 bg-[#0a0f1c]">
          {session ? (
            <>
              <Link
                href="/my-lists"
                onClick={closeMenu}
                className={`text-sm transition-colors py-2 border-b border-[rgba(255,255,255,0.07)] ${isActive('/my-lists') ? 'text-[#f0f4f8] font-semibold border-l-2 border-l-[#06C755] pl-2' : 'text-[#8fa3b8] hover:text-[#c8d6e5]'}`}
              >
                マイリスト
              </Link>
              <Link
                href="/profile"
                onClick={closeMenu}
                className={`text-sm transition-colors py-2 border-b border-[rgba(255,255,255,0.07)] ${isActive('/profile') ? 'text-[#f0f4f8] font-semibold border-l-2 border-l-[#06C755] pl-2' : 'text-[#8fa3b8] hover:text-[#c8d6e5]'}`}
              >
                プロフィール
              </Link>
              {credits !== null ? (
                <Link href="/credits" onClick={closeMenu} className="text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors py-2 border-b border-[rgba(255,255,255,0.07)] block">
                  💳 残クレジット: {credits.toLocaleString()}件
                </Link>
              ) : session ? (
                <Link href="/credits" onClick={closeMenu} className="text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors py-2 border-b border-[rgba(255,255,255,0.07)] block">
                  💳 残クレジット: --件
                </Link>
              ) : null}
              <Link
                href="/purchase"
                onClick={closeMenu}
                className="text-sm text-[#06C755] hover:text-[#04a344] font-bold transition-colors py-2 border-b border-[rgba(255,255,255,0.07)]"
              >
                クレジット購入
              </Link>
              <Link
                href="/contact"
                onClick={closeMenu}
                className="text-sm text-[#8fa3b8] hover:text-[#c8d6e5] transition-colors py-2 border-b border-[rgba(255,255,255,0.07)]"
              >
                お問い合わせ
              </Link>
              <button
                onClick={() => {
                  closeMenu()
                  signOut({ callbackUrl: '/login' })
                }}
                className="text-sm text-[#8494a7] hover:text-[#f0f4f8] transition-colors py-2 text-left"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={closeMenu}
                className="text-sm text-[#8fa3b8] hover:text-[#f0f4f8] transition-colors py-2 border-b border-[rgba(255,255,255,0.07)]"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                onClick={closeMenu}
                className="text-sm text-center bg-[#06C755] hover:bg-[#04a344] text-white px-4 py-2.5 rounded-full transition-all font-bold hover:shadow-[0_0_20px_rgba(6,199,85,0.5)]"
              >
                登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
    {showPaymentToast && (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-[rgba(6,199,85,0.15)] border border-[rgba(6,199,85,0.4)] text-[#06C755] px-6 py-3 rounded-xl text-sm font-bold shadow-lg animate-pulse">
        ✅ クレジットが追加されました！
      </div>
    )}
    </>
  )
}

function NavBar() {
  return (
    <Suspense fallback={null}>
      <NavBarInner />
    </Suspense>
  )
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#0a0f1c] text-[#f0f4f8] flex flex-col">
        <NavBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[rgba(255,255,255,0.07)] bg-[#060a14] py-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#8494a7] mb-2">
            <Link href="/legal/tokushoho" className="hover:text-[#06C755] transition-colors">特定商取引法に基づく表記</Link>
            <span>|</span>
            <Link href="/legal/privacy" className="hover:text-[#06C755] transition-colors">プライバシーポリシー</Link>
            <span>|</span>
            <Link href="/legal/terms" className="hover:text-[#06C755] transition-colors">利用規約</Link>
            <span>|</span>
            <Link href="/legal/company" className="hover:text-[#06C755] transition-colors">運営者情報</Link>
            <span>|</span>
            <Link href="/contact" className="hover:text-[#06C755] transition-colors">お問い合わせ</Link>
          </div>
          <div className="text-sm text-[#8494a7]">
            &copy; 2026 オートリスト — powered by{' '}
            <a
              href="https://shiryolog.com"
              className="text-[#06C755] hover:underline"
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
