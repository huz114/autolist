import { auth } from '@/auth'
import { NextResponse } from 'next/server'

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
