import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login') ||
                     req.nextUrl.pathname.startsWith('/register')
  const isPublicPage = req.nextUrl.pathname === '/' ||
                       req.nextUrl.pathname.startsWith('/autolist/results') ||
                       req.nextUrl.pathname.startsWith('/api/')

  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
