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
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity'
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity'
import { generateRandomToken, hashToken } from './utils/token'
import { env } from '../../config/env'
import { addHours } from 'date-fns'
import { createSession, deleteSession } from './session-store'

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

    const sessionId = await createSession({
      userId: user.id,
      createdAt: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    })
    setSessionCookie(res, sessionId)

    return res.status(200).json({ user })
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
    if (req.sessionId) {
      await deleteSession(req.sessionId)
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

// POST /auth/request-email-verification (user connecté)
// authRouter.post(
//   '/request-email-verification',
//   authMiddleware,
//   async (req: AuthRequest, res: Response, next: NextFunction) => {
//     try {
//       if (!req.userId) {
//         throw new AppError(ERR.UNAUTHORIZED)
//       }

//       const user = await usersRepo.findOne({ where: { id: req.userId } })
//       if (!user) {
//         throw new AppError(ERR.NOT_FOUND, 'User not found')
//       }

//       const tokenPlain = generateRandomToken(32)
//       const tokenHash = await hashToken(tokenPlain)

//       const entity = emailVerificationTokensRepo.create({
//         user,
//         tokenHash,
//         expiresAt: addHours(new Date(), env.EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS),
//         used: false
//       })

//       await emailVerificationTokensRepo.save(entity)

//       res.status(200).json({ verificationToken: tokenPlain })
//     } catch (err) {
//       return next(err)
//     }
//   }
// )

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
