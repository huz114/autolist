import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') ||
                     req.nextUrl.pathname.startsWith('/register') ||
                     req.nextUrl.pathname.startsWith('/forgot-password') ||
                     req.nextUrl.pathname.startsWith('/reset-password')
  const isPublicPage = req.nextUrl.pathname === '/' ||
                       req.nextUrl.pathname.startsWith('/autolist/results') ||
                       req.nextUrl.pathname.startsWith('/api/') ||
                       req.nextUrl.pathname.startsWith('/legal') ||
                       req.nextUrl.pathname.startsWith('/verify') ||
                       req.nextUrl.pathname.startsWith('/contact') ||
                       req.nextUrl.pathname.startsWith('/payment-callback')
  const isAdminPage = req.nextUrl.pathname.startsWith('/admin')

  // Admin pages: 管理者以外は404（ページの存在自体を隠す）
  if (isAdminPage) {
    const email = req.auth?.user?.email ?? ''
    if (!isLoggedIn || !ADMIN_EMAILS.includes(email)) {
      return NextResponse.rewrite(new URL('/not-found', req.url), { status: 404 })
    }
    return NextResponse.next()
  }

  // Redirect logged-in users away from auth pages (login/register)
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/my-lists', req.url))
  }

  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
