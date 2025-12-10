import { z } from 'zod'

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const mealPlanGenerationInputSchema = z.object({
  days: z.number().int().min(1).max(7).default(3),
  dailyCaloriesTarget: z.number().int().min(1000).max(5000).optional(),
  goal: z.enum(['WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN']).default('WEIGHT_LOSS'),
  dietStyle: z
    .enum(['NONE', 'VEGETARIAN', 'VEGAN', 'KETO', 'LOW_CARB', 'MEDITERRANEAN'])
    .default('NONE'),
  intolerances: z.array(z.string().max(50)).max(10).optional(),
  locale: z.enum(['en', 'fr', 'de']).optional()
})

export type MealPlanGenerationInput = z.infer<typeof mealPlanGenerationInputSchema>

export const mealPlanMealSchema = z.object({
  mealType: z.enum(MEAL_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  calories: z.number().int().min(0).max(3000),
  proteinGrams: z.number().min(0).max(200).optional(),
  carbsGrams: z.number().min(0).max(300).optional(),
  fatGrams: z.number().min(0).max(150).optional(),
  // ex: ["2 oeufs", "50g d'avoine", ...]
  ingredients: z.array(z.string().min(1).max(200)).min(1).max(30),
  // étapes de préparation
  steps: z.array(z.string().min(1).max(500)).min(1).max(20),
  notes: z.string().max(500).optional()
})

export type MealPlanMeal = z.infer<typeof mealPlanMealSchema>

export const mealPlanDaySchema = z.object({
  dayIndex: z.number().int().min(1), // 1 = jour 1, etc.
  label: z.string().min(1).max(100), // ex "Jour 1", "Lundi"
  totalCalories: z.number().int().min(0).max(8000),
  meals: z.array(mealPlanMealSchema).min(1).max(10)
})

export type MealPlanDay = z.infer<typeof mealPlanDaySchema>

export const mealPlanSchema = z.object({
  goal: z.enum(['WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN']),
  days: z.array(mealPlanDaySchema).min(1).max(7),
  dailyCaloriesTarget: z.number().int().min(800).max(6000).optional(),
  // ex : "Plan adapté au jeûne 16:8, privilégie protéines..."
  coachNotes: z.string().max(2000).optional()
})

export type MealPlan = z.infer<typeof mealPlanSchema>
