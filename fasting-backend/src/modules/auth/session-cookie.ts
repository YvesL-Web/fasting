import { Response } from 'express'

import { env } from '../../config/env'

export function setSessionCookie(res: Response, sessionId: string) {
  const isProd = env.NODE_ENV === 'production'

  res.cookie(env.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd && env.SESSION_COOKIE_SECURE, // en dev false
    sameSite: 'lax',
    maxAge: env.SESSION_TTL_SECONDS * 1000,
    path: '/',
    domain: env.SESSION_COOKIE_DOMAIN || undefined
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    path: '/',
    domain: env.SESSION_COOKIE_DOMAIN || undefined
  })
}
