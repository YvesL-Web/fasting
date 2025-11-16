// modules/auth/auth.service.ts
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { Repository } from 'typeorm'
import { z } from 'zod'

import { UserEntity } from '../users/user.entity'
import type {
  RegisterInput,
  LoginInput,
  AuthUser,
  RequestPasswordResetInput,
  ResetPasswordInput
} from './auth.schemas.js'
import { env } from '../../config/env.js'
import { AppError, ERR } from '../../utils/error.js'
import { RefreshTokenEntity } from './entities/refresh-token.entity.js'
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity.js'
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity.js'
import { generateRandomToken, hashToken, verifyTokenHash } from './utils/token.js'
import { addDays, addHours, addMinutes, isBefore } from 'date-fns'
import { logger } from '../../utils/logger'

const jwtSecretSchema = z.string().min(10)
const jwtSecret = jwtSecretSchema.parse(env.JWT_SECRET ?? '')

export class AuthService {
  constructor(
    private readonly usersRepo: Repository<UserEntity>,
    private readonly refreshTokensRepo: Repository<RefreshTokenEntity>,
    private readonly emailVerificationTokensRepo: Repository<EmailVerificationTokenEntity>,
    private readonly passwordResetTokensRepo: Repository<PasswordResetTokenEntity>
  ) {}

  private toAuthUser(entity: UserEntity): AuthUser {
    return {
      id: entity.id,
      email: entity.email,
      displayName: entity.displayName,
      locale: entity.locale,
      role: entity.role,
      subscriptionPlan: entity.subscriptionPlan,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    }
  }

  private createAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role
      },
      env.JWT_ACCESS_SECRET,
      {
        expiresIn: '15m'
      }
    )
  }

  private createRefreshTokenPayload(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id
      },
      env.JWT_REFRESH_SECRET,
      {
        expiresIn: '7d'
      }
    )
  }

  async register(input: RegisterInput): Promise<{
    user: AuthUser
    accessToken: string
    refreshToken: string
    emailVerificationToken: string
  }> {
    const email = input.email.toLowerCase()
    const existing = await this.usersRepo.findOne({
      where: { email }
    })

    if (existing) {
      throw new AppError(ERR.EMAIL_TAKEN)
    }

    const passwordHash = await argon2.hash(input.password)

    const user = this.usersRepo.create({
      email,
      passwordHash,
      displayName: input.displayName,
      locale: input.locale,
      emailVerifiedAt: null
    })

    const saved = await this.usersRepo.save(user)
    const authUser = this.toAuthUser(saved)

    // access token
    const accessToken = this.createAccessToken(authUser)

    // refresh token
    const refreshTokenPlain = generateRandomToken(32)
    const refreshTokenHash = await hashToken(refreshTokenPlain)
    const refreshTokenEntity = this.refreshTokensRepo.create({
      user: saved,
      tokenHash: refreshTokenHash,
      expiresAt: addDays(new Date(), 7),
      revoked: false
    })
    await this.refreshTokensRepo.save(refreshTokenEntity)

    // Create email verification token
    const emailTokenPlain = generateRandomToken(32)
    const emailTokenHash = await hashToken(emailTokenPlain)
    const emailTokenEntity = this.emailVerificationTokensRepo.create({
      user: saved,
      tokenHash: emailTokenHash,
      expiresAt: addHours(new Date(), env.EMAIL_VERIFICATION_TOKEN_EXPIRES_HOURS),
      used: false
    })

    await this.emailVerificationTokensRepo.save(emailTokenEntity)

    return {
      user: authUser,
      accessToken,
      refreshToken: refreshTokenPlain,
      emailVerificationToken: emailTokenPlain // en prod → envoyer par email
    }
  }

  async login(
    input: LoginInput
  ): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
    const email = input.email.toLowerCase()

    const user = await this.usersRepo.findOne({
      where: { email }
    })

    if (!user) {
      throw new AppError(ERR.INVALID_CREDENTIALS)
    }

    const valid = await argon2.verify(user.passwordHash, input.password)
    if (!valid) {
      throw new AppError(ERR.INVALID_CREDENTIALS)
    }

    const authUser = this.toAuthUser(user)

    const refreshTokenPlain = generateRandomToken(32)
    const refreshTokenHash = await hashToken(refreshTokenPlain)
    const refreshTokenEntity = this.refreshTokensRepo.create({
      user,
      tokenHash: refreshTokenHash,
      expiresAt: addDays(new Date(), 7),
      revoked: false
    })

    await this.refreshTokensRepo.save(refreshTokenEntity)

    const accessToken = this.createAccessToken(authUser)

    return { user: authUser, accessToken, refreshToken: refreshTokenPlain }
  }

  async refreshTokens(refreshTokenPlain: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    const allTokens = await this.refreshTokensRepo.find({
      relations: ['user']
    })

    const match = await Promise.all(
      allTokens.map(async (t) => ({
        token: t,
        valid: await verifyTokenHash(t.tokenHash, refreshTokenPlain)
      }))
    )

    const found = match.find((m) => m.valid)?.token

    if (!found || found.revoked || isBefore(found.expiresAt, new Date())) {
      throw new AppError(ERR.UNAUTHORIZED, 'invalid refresh token')
    }

    const user = found.user
    const authUser = this.toAuthUser(user)

    // rotate refresh token
    found.revoked = true
    await this.refreshTokensRepo.save(found)

    const newRefreshPlain = generateRandomToken(32)
    const newRefreshHash = await hashToken(newRefreshPlain)
    const newRefreshEntity = this.refreshTokensRepo.create({
      user,
      tokenHash: newRefreshHash,
      expiresAt: addDays(new Date(), 7),
      revoked: false
    })
    await this.refreshTokensRepo.save(newRefreshEntity)

    const newAccessToken = this.createAccessToken(authUser)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshPlain
    }
  }

  async logout(refreshTokenPlain: string): Promise<void> {
    const allTokens = await this.refreshTokensRepo.find()
    const match = await Promise.all(
      allTokens.map(async (t) => ({
        token: t,
        valid: await verifyTokenHash(t.tokenHash, refreshTokenPlain)
      }))
    )
    const found = match.find((m) => m.valid)?.token
    if (!found) return
    found.revoked = true
    await this.refreshTokensRepo.save(found)
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<{ resetToken: string }> {
    const user = await this.usersRepo.findOne({
      where: { email: input.email.toLowerCase() }
    })
    if (!user) {
      // on ne révèle pas si l'email existe ou non
      return { resetToken: '' }
    }

    const tokenPlain = generateRandomToken(32)
    const tokenHash = await hashToken(tokenPlain)

    const entity = this.passwordResetTokensRepo.create({
      user,
      tokenHash,
      expiresAt: addMinutes(new Date(), env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES),
      used: false
    })
    await this.passwordResetTokensRepo.save(entity)

    // en prod : envoyer par email; en dev on le retourne
    return { resetToken: tokenPlain }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokens = await this.passwordResetTokensRepo.find({
      relations: ['user']
    })

    const match = await Promise.all(
      tokens.map(async (t) => ({
        token: t,
        valid: await verifyTokenHash(t.tokenHash, input.token)
      }))
    )

    const found = match.find((m) => m.valid)?.token

    if (!found || found.used || isBefore(found.expiresAt, new Date())) {
      throw new AppError(ERR.BAD_REQUEST, 'invalid or expired password reset token')
    }

    const user = found.user

    user.passwordHash = await argon2.hash(input.newPassword)
    await this.usersRepo.save(user)

    found.used = true
    await this.passwordResetTokensRepo.save(found)
  }

  async verifyEmail(tokenPlain: string): Promise<void> {
    const tokens = await this.emailVerificationTokensRepo.find({
      relations: ['user']
    })

    const match = await Promise.all(
      tokens.map(async (t) => ({
        token: t,
        valid: await verifyTokenHash(t.tokenHash, tokenPlain)
      }))
    )

    const found = match.find((m) => m.valid)?.token

    if (!found || found.used || isBefore(found.expiresAt, new Date())) {
      throw new AppError(ERR.BAD_REQUEST, 'invalid or expired email verification token')
    }

    const user = found.user
    user.emailVerifiedAt = new Date()
    await this.usersRepo.save(user)

    found.used = true
    await this.emailVerificationTokensRepo.save(found)
  }
}
