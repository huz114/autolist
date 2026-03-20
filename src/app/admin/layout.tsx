'use client'

import { SessionProvider } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin/requests', label: '依頼管理' },
  { href: '/admin/analytics', label: 'アナリティクス' },
  { href: '/admin/search-logs', label: '検索ログ' },
  { href: '/admin/exclusion-analytics', label: '除外分析' },
  { href: '/admin/unverified-companies', label: '未確認企業' },
  { href: '/admin/gemini-usage', label: 'Geminiコスト' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <SessionProvider>
      <nav className="bg-[#0a0a0a] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 h-12 overflow-x-auto">
            <span className="text-xs text-gray-500 mr-3 flex-shrink-0">Admin</span>
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm px-3 py-1.5 rounded transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
      {children}
    </SessionProvider>
  )
}
