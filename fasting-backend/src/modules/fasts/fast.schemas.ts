import { z } from 'zod'

export const fastingPresets = [
  { id: '12_12', label: '12:12', fastingHours: 12, eatingHours: 12 },
  { id: '14_10', label: '14:10', fastingHours: 14, eatingHours: 10 },
  { id: '16_8', label: '16:8', fastingHours: 16, eatingHours: 8 },
  { id: '18_6', label: '18:6', fastingHours: 18, eatingHours: 6 },
  { id: '20_4', label: '20:4', fastingHours: 20, eatingHours: 4 },
  { id: 'OMAD', label: 'OMAD (23:1)', fastingHours: 23, eatingHours: 1 }
] as const

export type FastingPreset = (typeof fastingPresets)[number]
export type FastingPresetId = FastingPreset['id']

const presetIds = fastingPresets.map((p) => p.id) as [FastingPresetId, ...FastingPresetId[]]

export const startFastSchema = z.object({
  type: z.enum(presetIds),
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

// ----- Ancien -------
// import { FAST_TYPES } from '@fasting/shared'
// export const startFastSchema = z.object({
//   type: z.enum(FAST_TYPES),
//   // optionnel : permettre de démarrer un jeûne dans le passé
//   startAt: z.coerce.date().optional(),
//   notes: z.string().max(500).optional()
// })

// export const stopFastSchema = z.object({
//   endAt: z.coerce.date().optional(),
//   notes: z.string().max(500).optional()
// })

// export const listFastsQuerySchema = z.object({
//   limit: z.coerce.number().int().min(1).max(100).default(20),
//   offset: z.coerce.number().int().min(0).default(0)
// })

// export const fastStatsSchema = z.object({
//   totalFasts: z.number().int().nonnegative(),
//   totalHours: z.number().nonnegative(),
//   averageHours: z.number().nonnegative(),
//   longestFastHours: z.number().nonnegative(),
//   currentStreakDays: z.number().int().nonnegative()
// })

// export type StartFastInput = z.infer<typeof startFastSchema>
// export type StopFastInput = z.infer<typeof stopFastSchema>
// export type ListFastsQuery = z.infer<typeof listFastsQuerySchema>
// export type FastStats = z.infer<typeof fastStatsSchema>

// export type FastStats = {
//   totalFasts: number
//   totalHours: number
//   averageHours: number
//   longestFastHours: number
//   currentStreakDays: number
// }
