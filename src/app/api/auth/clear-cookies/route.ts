import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(
    new URL('http://localhost:3007/login')
  )

  // Clear all auth-related cookies
  const cookiesToClear = [
    'authjs.session-token',
    'authjs.callback-url',
    'authjs.csrf-token',
    '__Secure-authjs.session-token',
    '__Host-authjs.csrf-token',
    'next-auth.session-token',
    'next-auth.callback-url',
    'next-auth.csrf-token',
  ]

  cookiesToClear.forEach((cookieName) => {
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
    })
  })

  return response
}
