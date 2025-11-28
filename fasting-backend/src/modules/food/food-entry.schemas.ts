import { z } from 'zod'

export const createFoodEntrySchema = z.object({
  label: z.string().min(1).max(255),
  calories: z.number().int().positive().max(5000).optional(),
  proteinGrams: z.number().nonnegative().max(500).optional(),
  carbsGrams: z.number().nonnegative().max(500).optional(),
  fatGrams: z.number().nonnegative().max(500).optional(),
  // si omis → backend utilisera "maintenant"
  loggedAt: z.coerce.date().optional()
})

// pour commencer : filtre par jour
export const listFoodEntriesQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
    .optional()
})

export type CreateFoodEntryInput = z.infer<typeof createFoodEntrySchema>
export type ListFoodEntriesQuery = z.infer<typeof listFoodEntriesQuerySchema>
