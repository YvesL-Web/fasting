import { z } from 'zod'

const ingredientSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z
    .string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
})

const stepSchema = z.object({
  order: z.number().int().min(1),
  text: z.string().min(1)
})

// pour multipart, beaucoup de champs arrivent en string → on utilise z.coerce

export const createRecipeSchema = z.object({
  title: z.string().min(2).max(255),
  description: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  isPublic: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') return v === 'true'
      return false
    }),
  prepTimeMinutes: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  cookTimeMinutes: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  servings: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  totalCalories: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  proteinGrams: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  carbsGrams: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  fatGrams: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }),
  // on attend un JSON stringifié côté front
  ingredients: z
    .preprocess((v) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return []
        }
      }
      return v
    }, z.array(ingredientSchema).optional())
    .optional(),
  steps: z
    .preprocess((v) => {
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        } catch {
          return []
        }
      }
      return v
    }, z.array(stepSchema).optional())
    .optional(),
  tags: z
    .preprocess((v) => {
      if (typeof v === 'string') {
        // "petit-dej,snack" -> ['petit-dej','snack']
        return v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }
      return v
    }, z.array(z.string().max(50)).optional())
    .optional()
})

export const updateRecipeSchema = createRecipeSchema.partial()

export const listRecipesQuerySchema = z.object({
  scope: z.enum(['me', 'public']).default('public'),
  tag: z.string().optional(),
  search: z.string().optional()
})

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>
