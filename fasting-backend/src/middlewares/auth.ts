import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'
import { AppError, ERR } from '../utils/error'
import { getSession, rotateSessionIfNeeded } from '../modules/auth/session-store'

export interface AuthRequest extends Request {
  userId?: string
  sessionId?: string
}

// même options que celles que tu utilises au login pour set le cookie
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/'
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cookieName = env.SESSION_COOKIE_NAME
    const sid = (req.cookies && req.cookies[cookieName]) as string | undefined

    if (!sid) {
      return next(
        new AppError(
          { ...ERR.UNAUTHORIZED, message: 'Authentication required.' },
          { reason: 'MISSING_SESSION_COOKIE' }
        )
      )
    }

    const session = await getSession(sid)
    if (!session) {
      return next(
        new AppError(
          { ...ERR.UNAUTHORIZED, message: 'Session expired or invalid.' },
          { reason: 'INVALID_SESSION' }
        )
      )
    }

    // récup ip & UA
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null

    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null

    // 🔁 rotation éventuelle
    const {
      sessionId: effectiveSid,
      session: effectiveSession,
      rotated
    } = await rotateSessionIfNeeded(sid, session, { ip, userAgent })

    if (rotated) {
      // on renvoie le nouveau cookie au client
      res.cookie(cookieName, effectiveSid, cookieOptions)
    }

    req.userId = effectiveSession.userId
    req.sessionId = sid

    return next()
  } catch (error) {
    return next(
      new AppError(
        { ...ERR.SERVER_ERROR, message: 'Failed to validate session.' },
        { reason: 'SESSION_CHECK_ERROR', error }
      )
    )
  }
}
