import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  locale: z.enum(['en', 'fr', 'de'])
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const SUBSCRIPTION_PLANS = ['FREE', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY'] as const
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const userIdSchema = z.uuid()
export const userSchema = z.object({
  id: userIdSchema,
  email: z.email(),
  displayName: z.string().min(1).max(100),
  locale: z.enum(['en', 'fr', 'de']).default('en'),
  role: z.enum(USER_ROLES).default('USER'),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS).default('FREE'),
  createdAt: z.date(),
  updatedAt: z.date()
})

export type User = z.infer<typeof userSchema>
