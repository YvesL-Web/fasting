import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError, ERR } from '../utils/error'

export interface AuthRequest extends Request {
  userId?: string
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(ERR.UNAUTHORIZED, 'missing or invalid authorization header'))
  }

  const token = authHeader.substring('Bearer '.length)

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string }
    req.userId = payload.sub
    return next()
  } catch {
    return next(new AppError(ERR.UNAUTHORIZED, 'invalid token'))
  }
}
