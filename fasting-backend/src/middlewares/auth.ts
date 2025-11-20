import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError, ERR } from '../utils/error'
import { getSession, touchSession } from '../modules/auth/session-store'

export interface AuthRequest extends Request {
  userId?: string
  sessionId?: string
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

    // Sliding idle window
    void touchSession(sid)

    req.userId = session.userId
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
