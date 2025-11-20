import { z } from 'zod'
import { userSchema } from '@fasting/shared'

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100),
  locale: z.enum(['en', 'fr', 'de']).default('en')
})

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100)
})

export const requestPasswordResetSchema = z.object({
  email: z.email()
})

export const resetPasswordSchema = z.object({
  email: z.email(),
  code: z.string().min(4).max(10),
  newPassword: z.string().min(8).max(100)
})

export const verifyEmailSchema = z.object({
  email: z.email(),
  code: z.string().length(6).regex(/^\d+$/)
})

export const authUserSchema = userSchema

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
