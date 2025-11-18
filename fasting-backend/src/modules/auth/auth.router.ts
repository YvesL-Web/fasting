import { Router } from 'express'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import { UserEntity } from '../users/user.entity'
import { AuthService } from './auth.service'
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth.schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'
import { RefreshTokenEntity } from './entities/refresh-token.entity'
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity'
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity'
import { generateRandomToken, hashToken } from './utils/token'
import { env } from '../../config/env'
import { addHours } from 'date-fns'

const usersRepo = appDataSource.getRepository(UserEntity)
const refreshTokensRepo = appDataSource.getRepository(RefreshTokenEntity)
const emailVerificationTokensRepo = appDataSource.getRepository(EmailVerificationTokenEntity)
const passwordResetTokensRepo = appDataSource.getRepository(PasswordResetTokenEntity)

const authService = new AuthService(
  usersRepo,
  refreshTokensRepo,
  emailVerificationTokensRepo,
  passwordResetTokensRepo
)

export const authRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body)
    const { user, accessToken, refreshToken, emailVerificationToken } = await authService.register(
      parsed
    )

    // en dev : on renvoie le token email dans la réponse
    return res.status(201).json({ user, accessToken, refreshToken, emailVerificationToken })
  } catch (err) {
    // Validation → AppError(INVALID_INPUT) géré par errorHandler
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    // Le reste (dont AppError du service) est envoyé au errorHandler
    return next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body)
    const { user, accessToken, refreshToken } = await authService.login(parsed)

    return res.status(200).json({ user, accessToken, refreshToken })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }

    return next(err)
  }
})

// POST /auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      refreshToken: z.string().min(10)
    })
    const { refreshToken } = bodySchema.parse(req.body)

    await authService.logout(refreshToken)
    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      refreshToken: z.string().min(10)
    })
    const { refreshToken } = bodySchema.parse(req.body)

    const result = await authService.refreshTokens(refreshToken)

    res.status(200).json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

authRouter.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
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
})

// POST /auth/request-password-reset
authRouter.post('/request-password-reset', async (req, res, next) => {
  try {
    const parsed = requestPasswordResetSchema.parse(req.body)
    const { resetToken } = await authService.requestPasswordReset(parsed)

    // en prod : ne pas renvoyer le token; en dev c'est pratique
    res.status(200).json({ ok: true, resetToken })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /auth/reset-password
authRouter.post('/reset-password', async (req, res, next) => {
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
authRouter.post(
  '/request-email-verification',
  authMiddleware,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError(ERR.UNAUTHORIZED)
      }

      const user = await usersRepo.findOne({ where: { id: req.userId } })
      if (!user) {
        throw new AppError(ERR.NOT_FOUND, 'User not found')
      }

      const tokenPlain = generateRandomToken(32)
      const tokenHash = await hashToken(tokenPlain)

      const entity = emailVerificationTokensRepo.create({
        user,
        tokenHash,
        expiresAt: addHours(new Date(), env.EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS),
        used: false
      })

      await emailVerificationTokensRepo.save(entity)

      res.status(200).json({ verificationToken: tokenPlain })
    } catch (err) {
      return next(err)
    }
  }
)

// POST /auth/verify-email
authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const parsed = verifyEmailSchema.parse(req.body)
    await authService.verifyEmail(parsed.token)
    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
