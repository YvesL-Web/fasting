import { z } from 'zod'

export const createFoodEntrySchema = z
  .object({
    label: z.string().min(1).max(255),
    calories: z.number().int().positive().max(5000).nullable().optional(),
    proteinGrams: z.number().nonnegative().max(500).nullable().optional(),
    carbsGrams: z.number().nonnegative().max(500).nullable().optional(),
    fatGrams: z.number().nonnegative().max(500).nullable().optional(),
    loggedAt: z.coerce.date().optional(),
    recipeId: z.uuid().nullable().optional(),
    foodItemId: z.uuid().nullable().optional(),
    isPostFast: z.boolean().optional().default(false)
  })
  .refine((data) => !(data.recipeId && data.foodItemId), {
    message: 'A food entry cannot reference both a recipe and a food item.'
  })

export const listFoodEntriesQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
    .optional()
})

export type FoodDaySummary = {
  day: string // YYYY-MM-DD
  totalCalories: number
  inWindowCalories: number
  outWindowCalories: number
  entriesCount: number
  postFastCalories: number
}

export const foodSummaryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
    .optional()
})

export type FoodTopRecipeSummary = {
  recipeId: string
  title: string
  imageUrl: string | null
  uses: number
  totalCalories: number
}

export type FoodSummaryResponse = {
  from: string
  to: string
  days: FoodDaySummary[]
  topRecipes: FoodTopRecipeSummary[]
}

export const updateFoodEntrySchema = z.object({
  label: z.string().min(1).max(255).optional(),

  calories: z.number().int().positive().max(5000).nullable().optional(),
  proteinGrams: z.number().nonnegative().max(500).nullable().optional(),
  carbsGrams: z.number().nonnegative().max(500).nullable().optional(),
  fatGrams: z.number().nonnegative().max(500).nullable().optional(),

  loggedAt: z.coerce.date().optional(),

  recipeId: z.uuid().nullable().optional(),
  foodItemId: z.uuid().nullable().optional(),

  isPostFast: z.boolean().optional()
})

export type UpdateFoodEntryInput = z.infer<typeof updateFoodEntrySchema>
export type CreateFoodEntryInput = z.infer<typeof createFoodEntrySchema>
export type ListFoodEntriesQuery = z.infer<typeof listFoodEntriesQuerySchema>
export type FoodSummaryQuery = z.infer<typeof foodSummaryQuerySchema>
