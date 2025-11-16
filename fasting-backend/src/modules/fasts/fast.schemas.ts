import { z } from 'zod'
import { FAST_TYPES } from '@fasting/shared'

export const startFastSchema = z.object({
  type: z.enum(FAST_TYPES),
  // optionnel : permettre de démarrer un jeûne dans le passé
  startAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional()
})

export const stopFastSchema = z.object({
  endAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional()
})

export const listFastsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

export const fastStatsSchema = z.object({
  totalFasts: z.number().int().nonnegative(),
  totalHours: z.number().nonnegative(),
  averageHours: z.number().nonnegative(),
  longestFastHours: z.number().nonnegative(),
  currentStreakDays: z.number().int().nonnegative()
})

export type StartFastInput = z.infer<typeof startFastSchema>
export type StopFastInput = z.infer<typeof stopFastSchema>
export type ListFastsQuery = z.infer<typeof listFastsQuerySchema>
export type FastStats = z.infer<typeof fastStatsSchema>
