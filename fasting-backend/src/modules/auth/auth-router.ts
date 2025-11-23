import { Router } from 'express'
import { z } from 'zod'
import type { NextFunction, Request, Response } from 'express'

import { appDataSource } from '../../infra/db'
import { UserEntity } from '../users/user.entity'
import { AuthService } from './auth-service'
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resendVerificationCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth-schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'
import { createSession, destroySession } from './session-store'
import { clearSessionCookie, setSessionCookie } from './session-cookie'
import { env } from '../../config/env'

const usersRepo = appDataSource.getRepository(UserEntity)
const authService = new AuthService(usersRepo)

export const authRouter = Router()

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.parse(req.body)
    const { message } = await authService.register(parsed)

    return res.status(201).json({ message })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body)
    const { user } = await authService.login(parsed)

    const sessionId = await createSession(user.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })
    setSessionCookie(res, sessionId)

    return res.status(200).json({ user, sessionId })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /auth/logout
authRouter.post('/logout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionCookieName = env.SESSION_COOKIE_NAME
    const sessionId = req.cookies?.[sessionCookieName]

    if (sessionId && typeof sessionId === 'string') {
      await destroySession(sessionId)
    }

    clearSessionCookie(res)

    return res.status(204).send()
  } catch (err) {
    return next(err)
  }
})

authRouter.get(
  '/me',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError(ERR.UNAUTHORIZED)
      }

      const user = await usersRepo.findOne({ where: { id: req.userId } })

      if (!user) {
        throw new AppError(ERR.NOT_FOUND, 'User not found')
      }

      const { passwordHash: _ignored, ...safeUser } = user
      return res.json({ user: safeUser })
    } catch (err) {
      return next(err)
    }
  }
)

// POST /auth/request-password-reset
authRouter.post(
  '/request-password-reset',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = requestPasswordResetSchema.parse(req.body)
      await authService.requestPasswordReset(parsed)
      res.status(200).json({ ok: true })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(AppError.fromZod(err))
      }
      return next(err)
    }
  }
)

// POST /auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body)
    await authService.resetPassword(parsed)
    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /auth/verify-email
authRouter.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = verifyEmailSchema.parse(req.body)
    await authService.verifyEmail({ email, code })
    res.status(200).json({ message: 'Email verified successfully.' })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

authRouter.post('/resend-verification-code', async (req, res, next) => {
  try {
    const parsed = resendVerificationCodeSchema.parse(req.body)
    await authService.resendVerificationEmail(parsed)

    return res.status(200).json({
      ok: true,
      message: 'If an account exists and is not verified, a new code has been sent.'
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
