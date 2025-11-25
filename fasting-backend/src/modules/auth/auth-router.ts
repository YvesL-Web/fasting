import { Router } from 'express'
import { z } from 'zod'
import type { NextFunction, Request, Response } from 'express'

import { appDataSource } from '../../infra/db'
import { UserEntity } from '../users/user.entity'
import { AuthService } from './auth-service'
import {
  changePasswordSchema,
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
import {
  createSession,
  destroyAllUserSessions,
  destroySession,
  listUserSessions
} from './session-store'
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

authRouter.post('/change-password', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError(ERR.UNAUTHORIZED)
    }

    const parsed = changePasswordSchema.parse(req.body)

    await authService.changePassword(req.userId, parsed)

    // On invalide cookie local : l’utilisateur devra se reconnecter
    clearSessionCookie(res)

    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

authRouter.post('/logout-all', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    await destroyAllUserSessions(req.userId)
    clearSessionCookie(res)

    res.status(204).send()
  } catch (err) {
    return next(err)
  }
})

authRouter.get('/sessions', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const sessions = await listUserSessions(req.userId)
    const currentId = req.sessionId

    const payload = sessions.map((s) => ({
      id: s.id,
      ip: s.ip ?? null,
      userAgent: s.userAgent ?? null,
      createdAt: s.createdAt,
      isCurrent: s.id === currentId
    }))

    res.status(200).json({ sessions: payload })
  } catch (err) {
    return next(err)
  }
})

authRouter.delete('/sessions/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const sessionIdToDelete = req.params.id
    if (!sessionIdToDelete) {
      throw new AppError(ERR.BAD_REQUEST, 'Missing session id')
    }

    // Vérifier que la session appartient bien à ce user
    const sessions = await listUserSessions(req.userId)
    const target = sessions.find((s) => s.id === sessionIdToDelete)
    if (!target) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'Session not found.' },
        { reason: 'SESSION_NOT_FOUND' }
      )
    }

    // On détruit cette session
    await destroySession(sessionIdToDelete)

    res.status(204).send()
  } catch (err) {
    return next(err)
  }
})
