import { z } from 'zod'

export const createFoodItemSchema = z.object({
  label: z.string().min(2).max(255),
  brand: z.string().min(1).max(255).optional(),
  servingSize: z.string().min(1).max(50).optional(),
  calories: z.number().int().positive().max(5000).optional(),
  proteinGrams: z.number().nonnegative().max(500).optional(),
  carbsGrams: z.number().nonnegative().max(500).optional(),
  fatGrams: z.number().nonnegative().max(500).optional()
})

export const searchFoodItemsQuerySchema = z.object({
  q: z.string().min(2).max(255),
  limit: z.coerce.number().int().min(1).max(50).optional()
})

export type CreateFoodItemInput = z.infer<typeof createFoodItemSchema>
export type SearchFoodItemsQuery = z.infer<typeof searchFoodItemsQuerySchema>
