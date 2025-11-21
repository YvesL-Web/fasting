import argon2 from 'argon2'
import { IsNull, Not, Repository } from 'typeorm'

import { UserEntity } from '../users/user.entity'
import type {
  RegisterInput,
  LoginInput,
  AuthUser,
  RequestPasswordResetInput,
  ResetPasswordInput,
  VerifyEmailInput
} from './auth-schemas'
import { env } from '../../config/env'
import { AppError, ERR } from '../../utils/error'
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity'
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity'
import { generateRandomToken, hashToken, verifyTokenHash } from './utils/token'
import { addMinutes, isBefore } from 'date-fns'
import { generateOtpCode, setOtp, verifyOtp } from '../../utils/otpService'
import { enqueuePasswordResetEmail, enqueueVerificationEmail } from './auth-email-jobs'

export class AuthService {
  constructor(private readonly usersRepo: Repository<UserEntity>) {}

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

  async register(input: RegisterInput): Promise<{
    message: string
  }> {
    const email = input.email.toLowerCase()
    const existing = await this.usersRepo.findOne({
      where: { email }
    })

    if (existing) {
      throw new AppError(
        { ...ERR.EMAIL_TAKEN, message: 'This email is already registered.' },
        { reason: 'EMAIL_TAKEN', email }
      )
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

    // Create email verification code and send email
    const code = generateOtpCode()
    const ttlSec = env.EMAIL_VERIFICATION_TTL_SECONDS ?? 900 // 15min par défaut
    await setOtp('email_verify', email, code, ttlSec) // 15 minutes

    await enqueueVerificationEmail({
      name: authUser.displayName,
      to: authUser.email,
      code
    })

    return {
      message: 'Check your inbox to verify your email before logging in.'
    }
  }

  async login(input: LoginInput): Promise<{ user: AuthUser }> {
    const email = input.email.toLowerCase()

    const user = await this.usersRepo.findOne({
      where: { email: email }
    })

    if (!user) {
      throw new AppError(ERR.INVALID_CREDENTIALS)
    }

    const valid = await argon2.verify(user.passwordHash, input.password)
    if (!valid) {
      throw new AppError(ERR.INVALID_CREDENTIALS)
    }

    // check if the email is verified
    if (!user.emailVerifiedAt) {
      throw new AppError(
        { ...ERR.FORBIDDEN, message: 'Email not verified.' },
        { reason: 'EMAIL_NOT_VERIFIED', email }
      )
    }

    const authUser = this.toAuthUser(user)

    return { user: authUser }
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    const user = await this.usersRepo.findOne({
      where: { email: input.email.toLowerCase() }
    })
    if (!user) {
      return
    }

    const code = generateOtpCode()
    const ttlSec = env.PASSWORD_RESET_TTL_SECONDS ?? 900 // 15min par défaut
    await setOtp('password_reset', user.email, code, ttlSec)

    await enqueuePasswordResetEmail({
      name: user.displayName,
      to: user.email,
      code
    })
    return
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const email = input.email.toLowerCase().trim()

    const user = await this.usersRepo.findOne({ where: { email } })
    if (!user) {
      // On reste vague pour éviter de révéler l'existence de l'email
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: 'Invalid reset request.' },
        { reason: 'RESET_USER_NOT_FOUND', email }
      )
    }
    const { ok, reason } = await verifyOtp('password_reset', email, input.code)
    if (!ok) {
      const msg =
        reason === 'too_many_attempts'
          ? 'Too many attempts. Try later.'
          : 'Invalid or expired code.'
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: msg },
        { reason: 'INVALID_OR_EXPIRED_PASSWORD_RESET_CODE', scope: 'password_reset' }
      )
    }

    user.passwordHash = await argon2.hash(input.newPassword)
    await this.usersRepo.save(user)

    // invalider toutes les sessions
    // deleteSessionsForUser(user.id)
  }

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const email = input.email.toLowerCase().trim()

    const user = await this.usersRepo.findOne({ where: { email } })
    if (!user) {
      throw new AppError(
        { ...ERR.NOT_FOUND, message: 'User not found.' },
        { reason: 'USER_NOT_FOUND', email }
      )
    }

    const { ok, reason } = await verifyOtp('email_verify', email, input.code)
    if (!ok) {
      const msg =
        reason === 'too_many_attempts'
          ? 'Too many attempts. Try later.'
          : 'Invalid or expired code.'
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: msg },
        { reason: 'INVALID_OR_EXPIRED_EMAIL_VERIFICATION_CODE', scope: 'email_verify' }
      )
    }

    user.emailVerifiedAt = new Date()
    await this.usersRepo.save(user)
  }
}
